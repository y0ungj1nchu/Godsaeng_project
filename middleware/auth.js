/**
 * 갓생 제조기 - JWT 인증 미들웨어
 * * '미들웨어': API 요청이 실제 로직에 도달하기 전 거치는 중간 처리 단계.
 * 이 파일은 API 요청 헤더의 토큰을 검증, 로그인한 사용자인지 확인하는 '보안 요원' 역할 수행.
 */
const jwt = require('jsonwebtoken');

// .env 파일의 JWT 비밀 키 가져옴.
// 값이 없을 경우 개발용 기본 키 사용 (실제 서비스에선 절대 사용 금지).
const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-key-for-development';

const authMiddleware = (req, res, next) => {
  // --- 1. 요청 헤더에서 토큰 확인 ---
  // 프론트엔드에서 API 요청 시, 헤더(headers)에 'Authorization' 이름으로 토큰을 담아 보냄.
  const authHeader = req.headers.authorization;

  // --- 2. 토큰 유무 및 형식 검사 ---
  // 토큰이 없거나, 'Bearer [토큰값]' 형식이 아니면 접근 거부.
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: '인증 토큰이 필요하거나 형식이 올바르지 않음.' });
  }

  // --- 3. 실제 토큰 값 추출 ---
  // 'Bearer ' 부분을 제외한 순수 토큰 문자열만 분리.
  const token = authHeader.split(' ')[1];

  try {
    // --- 4. 토큰 검증 ---
    // 저장된 JWT_SECRET으로 토큰의 위조/만료 여부 검증.
    // 검증 성공 시, 토큰 생성 시 담아둔 사용자 정보(payload) 해독.
    const decoded = jwt.verify(token, JWT_SECRET);

    // --- 5. 사용자 정보 전달 ---
    // 해독된 사용자 정보를 req 객체에 'user' 라는 이름으로 담음.
    // 이를 통해, 이 미들웨어를 통과한 모든 API는 'req.user'로 현재 로그인한 사용자 정보에 접근 가능.
    req.user = decoded;

    // --- 6. 다음 단계로 이동 ---
    // 모든 검증 통과 후, 'next()'를 호출하여 다음 로직으로 요청 전달.
    next();

  } catch (error) {
    // --- 7. 토큰 검증 실패 처리 ---
    // 토큰 유효기간 만료 시
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: '토큰이 만료됨. 다시 로그인 필요.' });
    }
    // 그 외 유효하지 않은 토큰일 시
    return res.status(401).json({ message: '유효하지 않은 토큰임.' });
  }
};

/**
 * 관리자 권한 확인 미들웨어
 * - authMiddleware가 반드시 먼저 실행되어야 함.
 * - req.user 객체에 있는 role이 'ADMIN'인지 확인.
 */
const adminOnly = (req, res, next) => {
  if (req.user && req.user.role === 'ADMIN') {
    next(); // 관리자일 경우 다음 미들웨어로 진행
  } else {
    // 관리자가 아닐 경우 접근 거부
    res.status(403).json({ message: '접근 권한이 없습니다. 관리자만 사용 가능합니다.' });
  }
};


// 다른 파일에서 이 미들웨어(함수)를 사용하도록 내보냄.
module.exports = { authMiddleware, adminOnly };

