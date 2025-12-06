/**
 * 갓생 제조기 - JWT 인증 미들웨어
 * - API 요청이 실제 로직에 도달하기 전에 토큰을 검증하는 보안 담당.
 */

const jwt = require('jsonwebtoken');

// .env 파일의 JWT 비밀 키 가져오기
const JWT_SECRET =
  process.env.JWT_SECRET || "default-secret-key-for-development";


// -----------------------------------------------------
// 🔐 기본 인증 미들웨어
// -----------------------------------------------------
const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;

  // Authorization 헤더 형식 검증
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res
      .status(401)
      .json({ message: "인증 토큰이 필요하거나 형식이 올바르지 않습니다." });
  }

  const token = authHeader.split(" ")[1];

  try {
    // JWT 검증 → payload = { id, role }
    const decoded = jwt.verify(token, JWT_SECRET);

    // 필수 정보(id) 없는 경우 방어코드
    if (!decoded.id) {
      return res.status(401).json({ message: "잘못된 토큰입니다." });
    }

    req.user = decoded; // { id, role }

    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res
        .status(401)
        .json({ message: "토큰이 만료되었습니다. 다시 로그인해주세요." });
    }

    return res.status(401).json({ message: "유효하지 않은 토큰입니다." });
  }
};


// -----------------------------------------------------
// 🔐 관리자 전용 미들웨어
// -----------------------------------------------------
const adminOnly = (req, res, next) => {
  // authMiddleware를 통과한 상태이므로 req.user 존재
  // 단, role이 없는 토큰(payload 구버전 대비)도 대비
  if (!req.user || !req.user.role) {
    return res.status(403).json({
      message: "권한 정보가 누락되었습니다. 다시 로그인해주세요.",
    });
  }

  if (req.user.role === "ADMIN") {
    return next();
  }

  return res
    .status(403)
    .json({ message: "접근 권한이 없습니다. 관리자만 접근 가능합니다." });
};


// -----------------------------------------------------
// 외부에서 사용 가능하도록 export
// -----------------------------------------------------
module.exports = { authMiddleware, adminOnly };
