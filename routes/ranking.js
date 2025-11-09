const express = require('express');
const router = express.Router();
const db = require('../config/db'); //

/**
 * @route   GET /api/ranking
 * @desc    캐릭터 랭킹 조회 (레벨, 경험치 순)
 * @access  Public
 */
router.get('/', async (req, res) => {
  try {
    // 쿼리문을 godsaeng.sql 스키마에 맞게 수정
    const [rows] = await db.query(`
      SELECT
        c.characterName AS characterNickname,
        c.level,
        c.exp,
        c.characterImage AS characterImage, -- 1. 'c.image' 또는 'c.image_url' -> 'c.characterImage'로 수정
        u.nickname AS userNickname
      FROM Characters c
      JOIN Users u ON c.userId = u.id        -- 2. 'c.user_id = u.user_id' -> 'c.userId = u.id'로 수정
      ORDER BY
        c.level DESC,
        c.exp DESC
      LIMIT 100;
    `);

    res.json(rows);
  } catch (err) {
    console.error('랭킹 API 쿼리 오류:', err); // 터미널에 오류 출력
    res.status(500).send('Server Error');
  }
});

module.exports = router;