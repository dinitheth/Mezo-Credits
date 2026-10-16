// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title MezoFlow Vault (own lending pool)
/// @notice Lenders put in MUSD and earn the loan fees. Borrowers lock native
///  BTC and borrow MUSD at 250/200/150% safety levels. Below 110% anyone may
///  close the loan: they repay its MUSD and receive its Bitcoin.
///  Prices are posted by the owner with setPrice (USD per BTC, 18 decimals).
///  No imports so it deploys straight from Remix on Mezo testnet (31611).
interface IERC20 {
  function transfer(address to, uint256 value) external returns (bool);
  function transferFrom(address from, address to, uint256 value) external returns (bool);
}

contract FlowVault {
  struct Loan {
    uint256 backing; // locked BTC (wei)
    uint256 owed; // MUSD owed incl. past fees (wei)
    uint256 tier; // 150, 200 or 250
    uint256 updated; // last fee checkpoint
  }

  IERC20 public immutable musd;
  address public owner;

  uint256 public btcPrice; // USD per BTC, 18 decimals
  uint256 public priceTime;

  uint256 public constant MIN_BACKING = 110; // loans below this can be closed
  uint256 public constant SAFE_BACKING = 150; // withdrawals must keep this
  uint256 public constant FEE_BPS = 100; // 1% per year on owed amounts
  uint256 public constant YEAR = 365 days;

  uint256 public poolBalance; // MUSD held for lending (wei)
  uint256 public totalShares;
  mapping(address => uint256) public shares;
  mapping(address => Loan) public loans;

  bool private locked;

  event Lent(address indexed who, uint256 musd, uint256 sharesOut);
  event Unlent(address indexed who, uint256 musd, uint256 sharesIn);
  event Borrowed(address indexed who, uint256 backing, uint256 musd, uint256 tier);
  event BackingAdded(address indexed who, uint256 backing);
  event Repaid(address indexed who, uint256 musd);
  event BackingTaken(address indexed who, uint256 backing);
  event LoanClosed(address indexed who, address indexed by, uint256 backing);
  event PriceSet(uint256 price);

  error NoBacking();
  error BadTier();
  error TooLittle();
  error Unsafe();
  error NothingOwed();
  error NoPoolMoney();
  error NoShares();
  error OnlyOwner();
  error NoReentry();
  error SendFailed();
  error TakeFailed();

  modifier noReentry() {
    if (locked) revert NoReentry();
    locked = true;
    _;
    locked = false;
  }

  constructor(address _musd) {
    musd = IERC20(_musd);
    owner = msg.sender;
  }

  // -- owner price feed ------------------------------------------------------

  function setPrice(uint256 price) external {
    if (msg.sender != owner) revert OnlyOwner();
    btcPrice = price;
    priceTime = block.timestamp;
    emit PriceSet(price);
  }

  // -- views -----------------------------------------------------------------

  function backingValue(uint256 backing) public view returns (uint256) {
    return (backing * btcPrice) / 1e18;
  }

  function owedOf(address who) public view returns (uint256) {
    Loan memory l = loans[who];
    if (l.owed == 0) return 0;
    uint256 fee = (l.owed * FEE_BPS * (block.timestamp - l.updated)) / 10000 / YEAR;
    return l.owed + fee;
  }

  function backingRatio(address who) public view returns (uint256) {
    uint256 owed = owedOf(who);
    if (owed == 0) return type(uint256).max;
    return (backingValue(loans[who].backing) * 100) / owed;
  }

  function shareValue(uint256 n) public view returns (uint256) {
    if (totalShares == 0) return n;
    return (n * poolBalance) / totalShares;
  }

  function poolOf(address who) external view returns (uint256) {
    return shareValue(shares[who]);
  }

  // -- lenders ---------------------------------------------------------------

  function lend(uint256 amount) external noReentry {
    if (amount == 0) revert TooLittle();
    uint256 n =
      totalShares == 0 || poolBalance == 0 ? amount : (amount * totalShares) / poolBalance;
    if (!musd.transferFrom(msg.sender, address(this), amount)) revert TakeFailed();
    poolBalance += amount;
    totalShares += n;
    shares[msg.sender] += n;
    emit Lent(msg.sender, amount, n);
  }

  function unlend(uint256 n) external noReentry {
    if (n == 0 || shares[msg.sender] < n) revert NoShares();
    uint256 amount = shareValue(n);
    if (amount > poolBalance) revert NoPoolMoney();
    shares[msg.sender] -= n;
    totalShares -= n;
    poolBalance -= amount;
    if (!musd.transfer(msg.sender, amount)) revert SendFailed();
    emit Unlent(msg.sender, amount, n);
  }

  // -- borrowers -------------------------------------------------------------

  function _accrue(address who) private {
    Loan storage l = loans[who];
    if (l.owed == 0) return;
    uint256 fee = (l.owed * FEE_BPS * (block.timestamp - l.updated)) / 10000 / YEAR;
    l.owed += fee;
    l.updated = block.timestamp;
  }

  function openLoan(uint256 amount, uint256 tier) external payable noReentry {
    if (msg.value == 0) revert NoBacking();
    if (tier != 150 && tier != 200 && tier != 250) revert BadTier();
    if (amount == 0) revert TooLittle();
    if (amount > poolBalance) revert NoPoolMoney();
    uint256 value = backingValue(msg.value);
    if ((value * 100) / amount < tier) revert Unsafe();
    Loan storage l = loans[msg.sender];
    _accrue(msg.sender);
    l.backing += msg.value;
    l.owed += amount;
    l.tier = tier;
    l.updated = block.timestamp;
    poolBalance -= amount;
    if (!musd.transfer(msg.sender, amount)) revert SendFailed();
    emit Borrowed(msg.sender, msg.value, amount, tier);
  }

  function addBacking() external payable noReentry {
    if (msg.value == 0) revert NoBacking();
    Loan storage l = loans[msg.sender];
    if (l.owed == 0) revert NothingOwed();
    _accrue(msg.sender);
    l.backing += msg.value;
    emit BackingAdded(msg.sender, msg.value);
  }

  function repay(uint256 amount) external noReentry {
    Loan storage l = loans[msg.sender];
    if (l.owed == 0) revert NothingOwed();
    _accrue(msg.sender);
    uint256 a = amount > l.owed ? l.owed : amount;
    if (!musd.transferFrom(msg.sender, address(this), a)) revert TakeFailed();
    l.owed -= a;
    poolBalance += a;
    emit Repaid(msg.sender, a);
  }

  function takeBacking(uint256 backing) external noReentry {
    Loan storage l = loans[msg.sender];
    if (l.backing == 0) revert NoBacking();
    _accrue(msg.sender);
    if (backing == 0 || backing > l.backing) revert TooLittle();
    uint256 left = l.backing - backing;
    if (l.owed > 0) {
      if ((backingValue(left) * 100) / l.owed < SAFE_BACKING) revert Unsafe();
    }
    l.backing = left;
    (bool ok, ) = msg.sender.call{ value: backing }("");
    if (!ok) revert SendFailed();
    emit BackingTaken(msg.sender, backing);
  }

  function closeLoan(address who) external noReentry {
    Loan storage l = loans[who];
    if (l.owed == 0) revert NothingOwed();
    _accrue(who);
    if (backingRatio(who) >= MIN_BACKING) revert Unsafe();
    uint256 owed = l.owed;
    uint256 backing = l.backing;
    if (!musd.transferFrom(msg.sender, address(this), owed)) revert TakeFailed();
    poolBalance += owed;
    l.owed = 0;
    l.backing = 0;
    (bool ok, ) = msg.sender.call{ value: backing }("");
    if (!ok) revert SendFailed();
    emit LoanClosed(who, msg.sender, backing);
  }

  receive() external payable {}
}
