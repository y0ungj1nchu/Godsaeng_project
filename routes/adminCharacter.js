// routes/adminCharacter.js
const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const multer = require("multer");
const path = require("path");
const { authMiddleware, adminOnly } = require('../middleware/auth');

// 이미지 저장 위치 설정
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/characters"); // 서버 폴더에 저장
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

/* ----------------------------------------------
   1) 캐릭터 목록 조회
------------------------------------------------ */
router.get("/", authMiddleware, adminOnly, async (req, res) => {
  const [rows] = await pool.execute(
    "SELECT id, name, level, imagePath FROM CharacterTemplates ORDER BY level ASC"
  );
  res.json(rows);
});

/* ----------------------------------------------
   2) 캐릭터 등록
------------------------------------------------ */
router.post(
  "/",
  authMiddleware,
  adminOnly,
  upload.single("image"),
  async (req, res) => {
    const { name, level } = req.body;

    if (!req.file) {
      return res.status(400).json({ message: "이미지가 필요합니다." });
    }

    // 파일명만 DB에 저장
    const imagePath = req.file.filename;

    await pool.execute(
      "INSERT INTO CharacterTemplates (name, level, imagePath) VALUES (?, ?, ?)",
      [name, level, imagePath]
    );

    res.json({ message: "캐릭터 등록 완료" });
  }
);

/* ----------------------------------------------
   3) 캐릭터 삭제
------------------------------------------------ */
router.delete("/:id", authMiddleware, adminOnly, async (req, res) => {
  const { id } = req.params;

  await pool.execute("DELETE FROM CharacterTemplates WHERE id = ?", [id]);

  res.json({ message: "캐릭터 삭제 완료" });
});

module.exports = router;
