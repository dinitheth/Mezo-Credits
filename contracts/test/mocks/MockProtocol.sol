// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @dev Test-only MUSD with mint and approvals. Not deployed by the app.
contract MockMUSD {
  string public name = "Mock MUSD";
  string public symbol = "MUSD";
  uint8 public decimals = 18;

  mapping(address => uint256) public balanceOf;
  mapping(address => mapping(address => uint256)) public allowance;

  function mint(address to, uint256 amount) external {
    balanceOf[to] += amount;
  }

  function approve(address spender, uint256 amount) external returns (bool) {
    allowance[msg.sender][spender] = amount;
    return true;
  }

  function transfer(address to, uint256 amount) external returns (bool) {
    require(balanceOf[msg.sender] >= amount, "MUSD: balance");
    balanceOf[msg.sender] -= amount;
    balanceOf[to] += amount;
    return true;
  }

  function transferFrom(address from, address to, uint256 amount) external returns (bool) {
    require(balanceOf[from] >= amount, "MUSD: balance");
    require(allowance[from][msg.sender] >= amount, "MUSD: allowance");
    allowance[from][msg.sender] -= amount;
    balanceOf[from] -= amount;
    balanceOf[to] += amount;
    return true;
  }
}

/// @dev Test-only price feed. The real vault reads Mezo's PriceFeed.
contract MockPriceFeed {
  uint256 public price;
  bool public stale;

  constructor(uint256 _price) {
    price = _price;
  }

  function setPrice(uint256 _price) external {
    price = _price;
  }

  function setStale(bool _stale) external {
    stale = _stale;
  }

  function fetchPrice() external view returns (uint256) {
    require(!stale, "PriceFeed: Oracle is stale.");
    return price;
  }
}
