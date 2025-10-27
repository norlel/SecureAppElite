// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {FHE, euint32, euint128, externalEuint32} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title FriendCircle - 链上朋友圈（单合约版，FHE 计数 + 原生代币）
/// @notice 发帖、点赞（收取少量原生代币）、打赏（原生代币），同态加密聚合点赞数与打赏总额。
///         前端可通过 Relayer SDK（公网）或 Mock（本地）离链解密句柄。
contract FriendCircle is SepoliaConfig {
    struct Post {
        address author;
        string text;           // 小文本直接上链；大文件请放 IPFS，并在 text/ipfsHash 中保存引用
        string ipfsHash;       // 可为空
        uint256 timestamp;
        euint32 likeCount;     // 加密点赞数
        euint128 tipTotal;     // 加密打赏总额（单位：wei）
    }

    /// @dev 点赞所需的原生代币费用（wei），收到的费用直接转给作者
    uint256 public immutable likeFeeWei;

    uint256 public postCount;
    mapping(uint256 => Post) private _posts;
    mapping(uint256 => mapping(address => bool)) public hasLiked; // 防重复点赞

    event PostCreated(uint256 indexed postId, address indexed author);
    event Liked(uint256 indexed postId, address indexed user, uint256 feeWei);
    event Tipped(uint256 indexed postId, address indexed from, uint256 amountWei);

    constructor(uint256 likeFeeWei_) {
        likeFeeWei = likeFeeWei_;
    }

    /// @notice 发帖（小文本直接上链；大内容请存 IPFS 并在 ipfsHash 中保存 CID）
    function createPost(string calldata text, string calldata ipfsHash) external returns (uint256 postId) {
        postId = ++postCount;
        Post storage p = _posts[postId];
        p.author = msg.sender;
        p.text = text;
        p.ipfsHash = ipfsHash;
        p.timestamp = block.timestamp;
        // likeCount 和 tipTotal 默认未初始化（bytes32(0)），即未加密
        emit PostCreated(postId, msg.sender);
    }

    /// @notice 读取帖子元信息（不含加密计数）
    function getPost(uint256 postId)
        external
        view
        returns (address author, string memory text, string memory ipfsHash, uint256 timestamp)
    {
        _requirePost(postId);
        Post storage p = _posts[postId];
        return (p.author, p.text, p.ipfsHash, p.timestamp);
    }

    /// @notice 点赞：需支付 likeFeeWei 原生代币；同态累加加密点赞计数
    /// @param postId 帖子ID
    /// @param encOne 外部加密的 euint32=1 句柄
    /// @param inputProof 加密输入证明
    function like(uint256 postId, externalEuint32 encOne, bytes calldata inputProof) external payable {
        _requirePost(postId);
        Post storage p = _posts[postId];
        require(!hasLiked[postId][msg.sender], "ALREADY_LIKED");
        require(msg.value == likeFeeWei, "BAD_FEE");

        // 转给作者
        (bool ok, ) = p.author.call{value: msg.value}("");
        require(ok, "FEE_TRANSFER_FAILED");

        // FHE: fromExternal -> add -> allowThis/allow
        euint32 one = FHE.fromExternal(encOne, inputProof);
        p.likeCount = FHE.add(p.likeCount, one);

        // 后续调用继续访问&授权
        FHE.allowThis(p.likeCount);
        // 当前调用者可离链解密（便于点赞后立即显示）
        FHE.allow(p.likeCount, msg.sender);
        // 作者也可解密（便于查看自己的数据）
        FHE.allow(p.likeCount, p.author);

        hasLiked[postId][msg.sender] = true;
        emit Liked(postId, msg.sender, msg.value);
    }

    /// @notice 打赏（原生代币），同态累加加密的打赏总额（单位 wei）
    /// @dev 为节省 gas，使用标量累加，不要求外部加密输入
    function tip(uint256 postId) external payable {
        _requirePost(postId);
        require(msg.value > 0, "ZERO_TIP");
        Post storage p = _posts[postId];

        // 转给作者
        (bool ok, ) = p.author.call{value: msg.value}("");
        require(ok, "TIP_TRANSFER_FAILED");

        // FHE: 标量累加（更省 gas）
        p.tipTotal = FHE.add(p.tipTotal, uint128(msg.value));

        FHE.allowThis(p.tipTotal);
        FHE.allow(p.tipTotal, msg.sender);
        FHE.allow(p.tipTotal, p.author);

        emit Tipped(postId, msg.sender, msg.value);
    }

    /// @notice 获取加密点赞计数句柄
    function getEncryptedLikeCount(uint256 postId) external view returns (euint32) {
        _requirePost(postId);
        return _posts[postId].likeCount;
    }

    /// @notice 获取加密打赏总额句柄（单位 wei）
    function getEncryptedTipTotal(uint256 postId) external view returns (euint128) {
        _requirePost(postId);
        return _posts[postId].tipTotal;
    }

    /// @notice 作者或任何人可为自己申请该帖两个句柄的解密权限（便于公开展示）
    /// @dev 与官方模板一致：为 msg.sender 设置 ACL 读取权限；前端随后使用 userDecrypt 离链解密
    function grantDecryptForPost(uint256 postId) external {
        _requirePost(postId);
        Post storage p = _posts[postId];
        FHE.allow(p.likeCount, msg.sender);
        FHE.allow(p.tipTotal, msg.sender);
    }

    function _requirePost(uint256 postId) internal view {
        require(postId != 0 && postId <= postCount, "POST_NOT_FOUND");
    }
}


