// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title MezoFlow InvoiceRouter (Wave 1)
/// @notice Settles MUSD invoices with an EIP-712 delegation.
///  Payer signs Invoice(id,amount,to,desc,deadline,nonce) off-chain;
///  anyone can submit it, router verifies the signature, pulls MUSD via
///  transferFrom(payer -> to) and emits InvoicePaid.
///  Payer must `approve(router, amount)` on MUSD first.
///  No imports so it deploys straight from Remix on Mezo testnet (31611).
interface IERC20 {
  function transferFrom(address from, address to, uint256 value) external returns (bool);
}

contract InvoiceRouter {
  IERC20 public immutable musd;

  bytes32 private constant DOMAIN_TYPEHASH =
    keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
  bytes32 private constant INVOICE_TYPEHASH =
    keccak256("Invoice(string id,uint256 amount,address to,string desc,uint256 deadline,string nonce)");
  bytes32 private immutable CACHED_DOMAIN_SEPARATOR;
  uint256 private immutable CACHED_CHAIN_ID;

  /// payer => nonceHash => used (replay protection)
  mapping(address => mapping(bytes32 => bool)) public nonceUsed;

  event InvoicePaid(
    string indexed id,
    address indexed payer,
    address indexed to,
    uint256 amount,
    string desc
  );

  error BadSignature();
  error Expired();
  error NonceUsed();
  error TransferFailed();

  constructor(address _musd) {
    musd = IERC20(_musd);
    CACHED_CHAIN_ID = block.chainid;
    CACHED_DOMAIN_SEPARATOR = _domainSeparator();
  }

  function domainSeparator() public view returns (bytes32) {
    return block.chainid == CACHED_CHAIN_ID ? CACHED_DOMAIN_SEPARATOR : _domainSeparator();
  }

  function _domainSeparator() private view returns (bytes32) {
    return keccak256(
      abi.encode(
        DOMAIN_TYPEHASH,
        keccak256(bytes("MezoFlow")),
        keccak256(bytes("1")),
        block.chainid,
        address(this)
      )
    );
  }

  function hashInvoice(
    string calldata id,
    uint256 amount,
    address to,
    string calldata desc,
    uint256 deadline,
    string calldata nonce
  ) public view returns (bytes32) {
    return keccak256(
      abi.encodePacked(
        "\x19\x01",
        domainSeparator(),
        keccak256(
          abi.encode(
            INVOICE_TYPEHASH,
            keccak256(bytes(id)),
            amount,
            to,
            keccak256(bytes(desc)),
            deadline,
            keccak256(bytes(nonce))
          )
        )
      )
    );
  }

  function _splitSig(bytes calldata sig) private pure returns (uint8 v, bytes32 r, bytes32 s) {
    require(sig.length == 65, "bad sig len");
    assembly {
      r := calldataload(add(sig.offset, 0x20))
      s := calldataload(add(sig.offset, 0x40))
      v := byte(0, calldataload(add(sig.offset, 0x60)))
    }
    if (v < 27) v += 27;
  }

  /// @dev Payer signs off-chain; anyone (merchant/relayer/payer) can submit.
  function payInvoice(
    address payer,
    string calldata id,
    uint256 amount,
    address to,
    string calldata desc,
    uint256 deadline,
    string calldata nonce,
    bytes calldata sig
  ) external {
    if (block.timestamp > deadline) revert Expired();
    _verifyAndConsume(payer, id, amount, to, desc, deadline, nonce, sig);
    bool ok = musd.transferFrom(payer, to, amount);
    if (!ok) revert TransferFailed();

    emit InvoicePaid(id, payer, to, amount, desc);
  }

  function _verifyAndConsume(
    address payer,
    string calldata id,
    uint256 amount,
    address to,
    string calldata desc,
    uint256 deadline,
    string calldata nonce,
    bytes calldata sig
  ) internal {
    bytes32 nkey = keccak256(bytes(nonce));
    if (nonceUsed[payer][nkey]) revert NonceUsed();

    bytes32 digest = hashInvoice(id, amount, to, desc, deadline, nonce);
    (uint8 v, bytes32 r, bytes32 s) = _splitSig(sig);
    address signer = ecrecover(digest, v, r, s);
    if (signer == address(0) || signer != payer) revert BadSignature();

    nonceUsed[payer][nkey] = true;
  }
}
