const express = require('express');
const bcrypt = require('bcrypt');
const pool = require('../config/db');
const { authMiddleware, adminOnly } = require('../middleware/auth');
const router = express.Router();


// -------------------------------------------------------
// [GET] /api/user/me  : 로그인한 사용자 정보 조회
// -------------------------------------------------------
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const sql = `
      SELECT 
        u.id,
        u.email,
        u.nickname,
        u.theme_color,
        u.role,
        u.createdAt,
        c.level,
        c.exp,
        c.characterName,
        c.characterImage
      FROM Users u
      LEFT JOIN Characters c ON u.id = c.userId
      WHERE u.id = ?
    `;

    const [rows] = await pool.execute(sql, [userId]);

    if (rows.length === 0) {
      return res.status(404).json({ message: '사용자 정보를 찾을 수 없습니다.' });
    }

    const u = rows[0];

    return res.status(200).json({
      id: u.id,
      email: u.email,
      nickname: u.nickname,
      role: u.role,
      themeColor: u.theme_color,
      level: u.level || 1,
      exp: u.exp || 0,
      characterName: u.characterName || "캐릭터",
      characterImage: u.characterImage || "snoopy1",
      createdAt: u.createdAt
    });
  } catch (error) {
    console.error("내 정보 조회 API 오류:", error);
    res.status(500).json({ message: "서버 오류가 발생했습니다." });
  }
});



// -------------------------------------------------------
// [PUT] 닉네임 변경
// -------------------------------------------------------
router.put('/nickname', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { newNickname } = req.body;

    if (!newNickname || newNickname.length < 2 || newNickname.length > 10) {
      return res.status(400).json({ message: "닉네임은 2~10자 사이여야 합니다." });
    }

    await pool.execute('UPDATE Users SET nickname = ? WHERE id = ?', [newNickname, userId]);

    // 변경된 값 반영 위해 최신 사용자 정보 반환
    const [rows] = await pool.execute(
      'SELECT id, nickname FROM Users WHERE id = ?',
      [userId]
    );

    return res.json({
      message: "닉네임이 성공적으로 변경되었습니다.",
      user: rows[0]
    });

  } catch (error) {
    console.error("닉네임 변경 API 오류:", error);
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ message: "이미 사용 중인 닉네임입니다." });
    }
    res.status(500).json({ message: "서버 오류가 발생했습니다." });
  }
});



// -------------------------------------------------------
// [PUT] 비밀번호 변경
// -------------------------------------------------------
router.put('/password', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: '현재 비밀번호와 새 비밀번호를 모두 입력해주세요.' });
    }
    if (newPassword.length < 6 || newPassword.length > 12) {
      return res.status(400).json({ message: '새 비밀번호는 6~12자 사이여야 합니다.' });
    }

    const sql = 'SELECT password_hash FROM Users WHERE id = ?';
    const [rows] = await pool.execute(sql, [userId]);
    const user = rows[0];

    const isPasswordValid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({ message: '현재 비밀번호가 일치하지 않습니다.' });
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    await pool.execute('UPDATE Users SET password_hash = ? WHERE id = ?', [
      hashedNewPassword,
      userId,
    ]);

    // 📌 비밀번호 변경 후 토큰 무효화하도록 안내
    return res.status(200).json({
      message: '비밀번호가 성공적으로 변경되었습니다. 보안을 위해 다시 로그인 해주세요.'
    });

  } catch (error) {
    console.error("비밀번호 변경 API 오류:", error);
    res.status(500).json({ message: "서버 오류가 발생했습니다." });
  }
});



// -------------------------------------------------------
// 캐릭터 이름 변경
// -------------------------------------------------------
router.put('/character/name', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { characterName } = req.body;

    if (!characterName || characterName.length < 2 || characterName.length > 10) {
      return res.status(400).json({ message: '캐릭터 이름은 2~10자 사이여야 합니다.' });
    }

    await pool.execute('UPDATE Characters SET characterName = ? WHERE userId = ?', [
      characterName,
      userId,
    ]);

    res.json({ message: '캐릭터 이름이 성공적으로 변경되었습니다.', characterName });

  } catch (error) {
    console.error("캐릭터 이름 변경 API 오류:", error);
    res.status(500).json({ message: "서버 오류가 발생했습니다." });
  }
});



// -------------------------------------------------------
// 캐릭터 이미지 변경
// -------------------------------------------------------
router.put('/character/image', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { characterImage } = req.body;

    if (!characterImage) {
      return res.status(400).json({ message: '캐릭터 이미지가 필요합니다.' });
    }

    await pool.execute('UPDATE Characters SET characterImage = ? WHERE userId = ?', [
      characterImage,
      userId,
    ]);

    res.json({ message: '캐릭터 이미지가 성공적으로 변경되었습니다.', characterImage });

  } catch (error) {
    console.error("캐릭터 이미지 변경 API 오류:", error);
    res.status(500).json({ message: "서버 오류가 발생했습니다." });
  }
});



// -------------------------------------------------------
// 테마 색상 변경
// -------------------------------------------------------
router.patch('/theme', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { themeColor } = req.body;

    await pool.execute('UPDATE Users SET theme_color = ? WHERE id = ?', [
      themeColor,
      userId,
    ]);

    res.json({
      message: "테마가 성공적으로 변경되었습니다.",
      themeColor,
    });

  } catch (err) {
    console.error("테마 변경 오류:", err);
    res.status(500).json({ message: "테마 변경 실패" });
  }
});



// -------------------------------------------------------
// ⭐ 추가: 관리자 전용 테스트 API (adminOnly 적용 예시)
// -------------------------------------------------------
router.get('/admin/test', authMiddleware, adminOnly, (req, res) => {
  res.json({ message: "관리자 전용 API 접근 성공!" });
});


module.exports = router;
