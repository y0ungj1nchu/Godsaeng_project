const express = require('express');
const bcrypt = require('bcrypt'); // (님의 파일 기준: bcrypt)
const pool = require('../config/db');
const authMiddleware = require('../middleware/auth');
const router = express.Router();

// [GET] /api/user/me : 현재 로그인한 사용자의 프로필 정보를 조회
// --- (수정됨: Characters 테이블 JOIN 및 반환 필드 추가) ---
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const sql = `
      SELECT 
        u.id, 
        u.email, 
        u.nickname,
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

    const user = rows[0];
    // 프론트엔드가 필요한 모든 정보를 반환
    res.status(200).json({
        id: user.id,
        email: user.email,
        nickname: user.nickname, // 계정 닉네임
        level: user.level || 1,
        exp: user.exp || 0,
        characterName: user.characterName || '캐릭터', // 캐릭터 닉네임
        characterImage: user.characterImage || 'snoopy1' // 캐릭터 이미지
    });
  } catch (error) {
    console.error('내 정보 조회 API 오류:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// [PUT] /api/user/nickname : "계정" 닉네임 변경 API
// --- (수정 없음: Users.nickname을 잘 변경하고 있습니다) ---
router.put('/nickname', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        // (참고: ProfileTab.js에서는 newNickname을 보냅니다)
        const { newNickname } = req.body; 

        if (!newNickname || newNickname.length < 2 || newNickname.length > 10) {
            return res.status(400).json({ message: '닉네임은 2~10자 사이여야 합니다.' });
        }
        // Users 테이블 업데이트
        const sql = 'UPDATE Users SET nickname = ? WHERE id = ?';
        await pool.execute(sql, [newNickname, userId]);

        res.status(200).json({ message: '닉네임이 성공적으로 변경되었습니다.' });
    } catch (error) {
        console.error('닉네임 변경 API 오류:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: '이미 사용 중인 닉네임입니다.' });
        }
        res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    }
});

// [PUT] /api/user/password : 비밀번호 변경 API
// --- (수정 없음) ---
router.put('/password', authMiddleware, async (req, res) => {
    // (님의 코드와 동일...)
    try {
        const userId = req.user.id;
        const { currentPassword, newPassword } = req.body;
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ message: '현재 비밀번호와 새 비밀번호를 모두 입력해주세요.' });
        }
        if (newPassword.length < 6 || newPassword.length > 12) {
            return res.status(400).json({ message: '새 비밀번호는 6~12자 사이여야 합니다.' });
        }
        const userSql = 'SELECT password_hash FROM Users WHERE id = ?';
        const [rows] = await pool.execute(userSql, [userId]);
        const user = rows[0];
        const isPasswordValid = await bcrypt.compare(currentPassword, user.password_hash);
        if (!isPasswordValid) {
            return res.status(401).json({ message: '현재 비밀번호가 일치하지 않습니다.' });
        }
        const hashedNewPassword = await bcrypt.hash(newPassword, 10);
        const updateSql = 'UPDATE Users SET password_hash = ? WHERE id = ?';
        await pool.execute(updateSql, [hashedNewPassword, userId]);
        res.status(200).json({ message: '비밀번호가 성공적으로 변경되었습니다.' });
    } catch (error) {
        console.error('비밀번호 변경 API 오류:', error);
        res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    }
});


// ----------------------------------------------------------------
// [PUT] /api/user/character/name : "캐릭터 닉네임" 변경 API
// --- (신규 추가) ---
// ----------------------------------------------------------------
router.put('/character/name', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { characterName } = req.body; 

    if (!characterName || characterName.length < 2 || characterName.length > 10) {
      return res.status(400).json({ message: '캐릭터 이름은 2~10자 사이여야 합니다.' });
    }
    // (중요) Characters 테이블을 업데이트합니다.
    const sql = 'UPDATE Characters SET characterName = ? WHERE userId = ?';
    await pool.execute(sql, [characterName, userId]);
    res.status(200).json({ message: '캐릭터 이름이 성공적으로 변경되었습니다.' });
  } catch (error) {
    console.error('캐릭터 이름 변경 API 오류:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// ----------------------------------------------------------------
// [PUT] /api/user/character/image : "캐릭터 이미지" 변경 API
// --- (신규 추가) ---
// ----------------------------------------------------------------
router.put('/character/image', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { characterImage } = req.body; // 예: "snoopy2"

    if (!characterImage) {
      return res.status(400).json({ message: '캐릭터 이미지가 필요합니다.' });
    }
    // (중요) Characters 테이블을 업데이트합니다.
    const sql = 'UPDATE Characters SET characterImage = ? WHERE userId = ?';
    await pool.execute(sql, [characterImage, userId]);
    res.status(200).json({ message: '캐릭터 이미지가 성공적으로 변경되었습니다.' });
  } catch (error) {
    console.error('캐릭터 이미지 변경 API 오류:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});


module.exports = router;