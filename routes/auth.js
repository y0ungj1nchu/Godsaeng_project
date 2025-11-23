/**
 * 갓생 제조기 - 인증(Authentication) API 라우터
 * - 회원가입, 로그인 등 사용자 인증 관련 API
 */
const express = require('express');   //웹 서버를 구현하기 쉽게 해줌
const bcrypt = require('bcrypt');   //비밀번호를 해싱하고 대조해주는 라이브러리
const jwt = require('jsonwebtoken');   //토큰 가져오기
const pool = require('../config/db'); //데이터베이스 연결

const router = express.Router();  //API 요청을 연결 해줌
// .env 파일에 SECRET이 없더라도 서버가 멈추지 않도록 기본값을 설정
const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-key-for-development';

// 입력값 검증을 위한 함수
function validateSignupInput(email, password, nickname) {
  if (!email || !password || !nickname) {
    return '모든 필드를 입력해주세요.';
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return '올바른 이메일 형식이 아닙니다.';
  }
  if (password.length < 6 || password.length > 12) {
    return '비밀번호는 최소 6자리 이상 12자리 이하이어야 합니다.';
  }
  if (nickname.length < 2 || nickname.length > 10) {
    return '닉네임은 2~10자 사이여야 합니다.';
  }
  return null; // 오류가 없으면 null 반환
}

router.post('/signup', async (req, res) => {
  const { email, password, nickname } = req.body;
  
  // DB 커넥션을 pool에서 가져옴
  const connection = await pool.getConnection();

  try {
    // 1. 입력값 유효성 검사
    const validationError = validateSignupInput(email, password, nickname);
    if (validationError) {
      // 유효성 검증 실패 시, 400 에러 반환
      return res.status(400).json({ message: validationError });
    }

    // User와 Character 생성이 하나의 작업 단위로 처리되도록 보장
    await connection.beginTransaction();

    // 2. 비밀번호 암호화 (bcrypt 사용)
    const hashedPassword = await bcrypt.hash(password, 10);

    // 3. Users 테이블에 사용자 정보 저장
    const userSql = 'INSERT INTO Users (email, password_hash, nickname) VALUES (?, ?, ?)';
    const [userResult] = await connection.execute(userSql, [email, hashedPassword, nickname]);
    const newUserId = userResult.insertId; // 방금 생성된 사용자의 고유 ID 가져오기

    // 4. Characters 테이블에 기본 캐릭터 정보 생성
    const characterSql = 'INSERT INTO Characters (userId, level, exp) VALUES (?, ?, ?)';
    await connection.execute(characterSql, [newUserId, 1, 0]);

    // 5. 모든 DB 작업이 성공했으므로, 최종 반영 (커밋)
    await connection.commit();

    res.status(201).json({ message: '회원가입 성공!' });

  } catch (error) {
    // 6. 중간에 오류 발생 시, 모든 작업을 취소 (롤백)
    await connection.rollback();
    console.error('회원가입 API 오류:', error);

    // 7. 이메일 또는 닉네임 중복 에러 처리
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: '이미 사용 중인 이메일 또는 닉네임입니다.' });
    }

    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  } finally {
    // 8. 사용한 DB 커넥션을 pool에 반드시 반납
    connection.release();
  }
});

// [POST] /api/auth/login : 로그인 API
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // 필드 확인
    if (!email || !password) {
      return res.status(400).json({ message: '이메일과 비밀번호를 입력해주세요.' });
    }

    // 사용자 조회
    const sql = 'SELECT * FROM Users WHERE email = ?';
    const [rows] = await pool.execute(sql, [email]);
    const user = rows[0];

    if (!user) {
      return res.status(404).json({ message: '존재하지 않는 사용자입니다.' });
    }

    // 비밀번호 대조
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({ message: '비밀번호가 올바르지 않습니다.' });
    }

    // JWT 발급 (2시간 유효)
    const token = jwt.sign(
    { id: user.id, email: user.email, nickname: user.nickname, role: user.role },
    JWT_SECRET,
    { expiresIn: '2h' }
);

    // 응답 (비밀번호 제외한 사용자 정보 포함)
    res.status(200).json({
      message: '로그인 성공!',
      token,
      user: {
        id: user.id,
        email: user.email,
        nickname: user.nickname,
        role: user.role,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error('로그인 API 오류:', error);
    res.status(500).json({ message: '서버 내부 오류가 발생했습니다.' });
  }
});

module.exports = router;

