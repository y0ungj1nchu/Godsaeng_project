/**
 * 갓생 제조기 - 인증(Authentication) API 라우터
 * - 회원가입, 로그인 등 사용자 인증 관련 API
 */
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-key-for-development';


// ------------------------------------------
// 📌 입력값 검증 (회원가입)
// ------------------------------------------
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
  return null;
}



// ------------------------------------------
// 📌 회원가입 API
// ------------------------------------------
router.post('/signup', async (req, res) => {
  const { email, password, nickname } = req.body;

  const connection = await pool.getConnection();

  try {
    const validationError = validateSignupInput(email, password, nickname);
    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    await connection.beginTransaction();

    const hashedPassword = await bcrypt.hash(password, 10);

    const userSql =
      'INSERT INTO Users (email, password_hash, nickname) VALUES (?, ?, ?)';
    const [userResult] = await connection.execute(userSql, [
      email,
      hashedPassword,
      nickname,
    ]);

    const newUserId = userResult.insertId;

    const characterSql =
      'INSERT INTO Characters (userId, level, exp) VALUES (?, ?, ?)';
    await connection.execute(characterSql, [newUserId, 1, 0]);

    await connection.commit();

    res.status(201).json({ message: '회원가입 성공!' });
  } catch (error) {
    await connection.rollback();
    console.error('회원가입 API 오류:', error);

    if (error.code === 'ER_DUP_ENTRY') {
      return res
        .status(409)
        .json({ message: '이미 사용 중인 이메일 또는 닉네임입니다.' });
    }

    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  } finally {
    connection.release();
  }
});



// ------------------------------------------
// 📌 로그인 API
// ------------------------------------------
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ message: '이메일과 비밀번호를 입력해주세요.' });
    }

    const sql = 'SELECT * FROM Users WHERE email = ?';
    const [rows] = await pool.execute(sql, [email]);
    const user = rows[0];

    if (!user) {
      return res.status(404).json({ message: '존재하지 않는 사용자입니다.' });
    }

    const isPasswordValid = await bcrypt.compare(
      password,
      user.password_hash
    );
    if (!isPasswordValid) {
      return res
        .status(401)
        .json({ message: '비밀번호가 올바르지 않습니다.' });
    }

    // ------------------------------------------
    // JWT 발급 (payload 최소화)
    // email, nickname은 /me 에서 가져오도록 설계
    // ------------------------------------------
    const token = jwt.sign(
      { id: user.id, role: user.role },
      JWT_SECRET,
      { expiresIn: '2h' } // 2시간 유지
    );

    // ------------------------------------------
    // 로그인 시 user 정보는 /me 구조와 같게 반환한다
    // (프론트 AuthContext 일관성 필수)
    // ------------------------------------------
    res.status(200).json({
      message: '로그인 성공!',
      token,
      user: {
        id: user.id,
        email: user.email,
        nickname: user.nickname,
        role: user.role,
        themeColor: user.theme_color || '#FFD400',
        createdAt: user.createdAt
      }
    });

  } catch (error) {
    console.error('로그인 API 오류:', error);
    res.status(500).json({ message: '서버 내부 오류가 발생했습니다.' });
  }
});



// ------------------------------------------
// ⭐ 추가됨: 로그아웃 API
// 프론트 AuthContext.logout() 과 연동됨
// ------------------------------------------
router.post('/logout', authMiddleware, async (req, res) => {
  try {
    // 필요 시 토큰 블랙리스트를 DB에 저장하는 방식도 가능
    // 현재는 프론트가 토큰 삭제함으로써 로그아웃 완료

    return res.json({ message: '로그아웃 성공' });
  } catch (err) {
    console.error('로그아웃 API 오류:', err);
    res.status(500).json({ message: '로그아웃 처리 실패' });
  }
});



module.exports = router;
