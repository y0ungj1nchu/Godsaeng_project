const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const { authMiddleware } = require("../middleware/auth");

// 사용자 캐릭터 목록 가져오기
router.get("/", authMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      "SELECT id, name, level, imagePath FROM CharacterTemplates ORDER BY level ASC"
    );

    res.json(rows);
  } catch (err) {
    console.error("캐릭터 목록 API 오류:", err);
    res.status(500).json({ message: "캐릭터 목록 불러오기 오류" });
  }
});

module.exports = router;
