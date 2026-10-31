// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title MezoFlow Vault (shared lending pool)
/// @notice Lenders put in MUSD and earn the loan fees. Borrowers lock native
///  BTC and borrow MUSD at 250/200/150% safety levels. Below 110% anyone may
///  close the loan: they repay its MUSD and receive its Bitcoin.
///
///  The BTC price comes from Mezo's own PriceFeed. There is no owner-posted
///  price and no admin key. If Mezo's oracle is stale, price-dependent actions
///  revert until it is fresh again.
///
///  Share value counts cash **and** money out on loan. A new lender therefore
///  cannot dilute existing lenders while loans are open.
interface IERC20 {
  function transfer(address to, uint256 value) external returns (bool);
  function transferFrom(address from, address to, uint256 value) external returns (bool);
  function balanceOf(address who) external view returns (uint256);
}

interface IMezoPriceFeed {
  /// @return USD per BTC with 18 decimals. Reverts when the oracle is stale.
  function fetchPrice() external view returns (uint256);
}

contract FlowVault {
  struct Loan {
    uint256 backing; // locked BTC (wei)
    uint256 principal; // MUSD lent to this borrower, still outstanding
    uint256 owed; // principal + fees counted so far (wei)
    uint256 tier; // 150, 200 or 250 safety level chosen at open
    uint256 updated; // last fee checkpoint
  }

  IERC20 public immutable musd;
  IMezoPriceFeed public immutable priceFeed;

  uint256 public constant MIN_BACKING = 110; // loans below this can be closed
  uint256 public constant SAFE_BACKING = 150; // withdrawals must keep this
  uint256 public constant FEE_BPS = 100; // 1% per year on owed amounts
  uint256 public constant YEAR = 365 days;

  uint256 public totalLent; // principal out on loan (wei)
  uint256 public totalShares;
  mapping(address => uint256) public shares;
  mapping(address => Loan) public loans;

  bool private locked;

  event Lent(address indexed who, uint256 musd, uint256 sharesOut);
  event Unlent(address indexed who, uint256 musd, uint256 sharesIn);
  event Borrowed(address indexed who, uint256 backing, uint256 musd, uint256 tier, uint256 price);
  event BackingAdded(address indexed who, uint256 backing);
  event Repaid(address indexed who, uint256 musd, uint256 principal);
  event BackingTaken(address indexed who, uint256 backing);
  event LoanClosed(
    address indexed who,
    address indexed by,
    uint256 backing,
    uint256 musd,
    uint256 price
  );

  error NoBacking();
  error BadTier();
  error TooLittle();
  error Unsafe();
  error NothingOwed();
  error NoPoolMoney();
  error NoShares();
  error NoReentry();
  error SendFailed();
  error TakeFailed();
  error BadAddress();
  error PriceFailed();

  modifier noReentry() {
    if (locked) revert NoReentry();
    locked = true;
    _;
    locked = false;
  }

  constructor(address _musd, address _priceFeed) {
    if (_musd == address(0) || _priceFeed == address(0)) revert BadAddress();
    musd = IERC20(_musd);
    priceFeed = IMezoPriceFeed(_priceFeed);
  }

  // -- views -----------------------------------------------------------------

  /// @notice MUSD sitting in the contract and ready to lend or withdraw.
  function cash() public view returns (uint256) {
    return musd.balanceOf(address(this));
  }

  /// @notice Cash plus principal out on loan. Fees count only when repaid.
  function totalAssets() public view returns (uint256) {
    return cash() + totalLent;
  }

  /// @notice USD per BTC from Mezo's PriceFeed, 18 decimals.
  function btcPrice() public view returns (uint256) {
    return _mezoPrice();
  }

  function backingValue(uint256 backing) public view returns (uint256) {
    return (backing * _mezoPrice()) / 1e18;
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
    return (n * totalAssets()) / totalShares;
  }

  function sharesFor(uint256 amount) public view returns (uint256) {
    uint256 assets = totalAssets();
    if (totalShares == 0 || assets == 0) return amount;
    return (amount * totalShares) / assets;
  }

  function poolOf(address who) external view returns (uint256) {
    return shareValue(shares[who]);
  }

  function _mezoPrice() private view returns (uint256) {
    try priceFeed.fetchPrice() returns (uint256 price) {
      if (price == 0) revert PriceFailed();
      return price;
    } catch {
      revert PriceFailed();
    }
  }

  // -- lenders ---------------------------------------------------------------

  function lend(uint256 amount) external noReentry {
    if (amount == 0) revert TooLittle();
    uint256 n = sharesFor(amount);
    if (n == 0) revert TooLittle();
    if (!musd.transferFrom(msg.sender, address(this), amount)) revert TakeFailed();
    totalShares += n;
    shares[msg.sender] += n;
    emit Lent(msg.sender, amount, n);
  }

  function unlend(uint256 n) external noReentry {
    if (n == 0 || shares[msg.sender] < n) revert NoShares();
    uint256 amount = shareValue(n);
    if (amount == 0) revert TooLittle();
    if (amount > cash()) revert NoPoolMoney();
    shares[msg.sender] -= n;
    totalShares -= n;
    if (!musd.transfer(msg.sender, amount)) revert SendFailed();
    emit Unlent(msg.sender, amount, n);
  }

  // -- borrowers -------------------------------------------------------------

  function _accrue(Loan storage l) private {
    if (l.owed == 0) {
      l.updated = block.timestamp;
      return;
    }
    uint256 fee = (l.owed * FEE_BPS * (block.timestamp - l.updated)) / 10000 / YEAR;
    l.owed += fee;
    l.updated = block.timestamp;
  }

  function openLoan(uint256 amount, uint256 tier) external payable noReentry {
    if (msg.value == 0) revert NoBacking();
    if (tier != 150 && tier != 200 && tier != 250) revert BadTier();
    if (amount == 0) revert TooLittle();
    if (amount > cash()) revert NoPoolMoney();

    uint256 price = _mezoPrice();
    Loan storage l = loans[msg.sender];
    _accrue(l);

    uint256 newBacking = l.backing + msg.value;
    uint256 newOwed = l.owed + amount;
    uint256 value = (newBacking * price) / 1e18;
    if ((value * 100) / newOwed < tier) revert Unsafe();

    l.backing = newBacking;
    l.principal += amount;
    l.owed = newOwed;
    l.tier = tier;
    l.updated = block.timestamp;
    totalLent += amount;

    if (!musd.transfer(msg.sender, amount)) revert SendFailed();
    emit Borrowed(msg.sender, msg.value, amount, tier, price);
  }

  function addBacking() external payable noReentry {
    if (msg.value == 0) revert NoBacking();
    Loan storage l = loans[msg.sender];
    if (l.owed == 0) revert NothingOwed();
    _accrue(l);
    l.backing += msg.value;
    emit BackingAdded(msg.sender, msg.value);
  }

  function repay(uint256 amount) external noReentry {
    if (amount == 0) revert TooLittle();
    Loan storage l = loans[msg.sender];
    if (l.owed == 0) revert NothingOwed();
    _accrue(l);

    uint256 a = amount > l.owed ? l.owed : amount;
    uint256 principalPart = a > l.principal ? l.principal : a;
    if (!musd.transferFrom(msg.sender, address(this), a)) revert TakeFailed();

    l.principal -= principalPart;
    l.owed -= a;
    totalLent -= principalPart;
    emit Repaid(msg.sender, a, principalPart);
  }

  function takeBacking(uint256 backing) external noReentry {
    Loan storage l = loans[msg.sender];
    if (l.backing == 0) revert NoBacking();
    _accrue(l);
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
    _accrue(l);

    uint256 price = _mezoPrice();
    uint256 owed = l.owed;
    uint256 backing = l.backing;
    uint256 value = (backing * price) / 1e18;
    if ((value * 100) / owed >= MIN_BACKING) revert Unsafe();

    uint256 principal = l.principal;
    if (!musd.transferFrom(msg.sender, address(this), owed)) revert TakeFailed();

    l.principal = 0;
    l.owed = 0;
    l.backing = 0;
    totalLent -= principal;

    (bool ok, ) = msg.sender.call{ value: backing }("");
    if (!ok) revert SendFailed();
    emit LoanClosed(who, msg.sender, backing, owed, price);
  }

  receive() external payable {}
}
