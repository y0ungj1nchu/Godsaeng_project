const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const { authMiddleware, adminOnly } = require("../middleware/auth");
const multer = require("multer");
const XLSX = require("xlsx");

// ---------------------------------------
// 1) 단어 세트 목록 조회
// ---------------------------------------
router.get("/sets", authMiddleware, adminOnly, async (req, res) => {
  const [rows] = await pool.execute(`
    SELECT id, setTitle, userId, createdAt 
    FROM WordSets 
    ORDER BY createdAt DESC
  `);
  res.json(rows);
});

// ---------------------------------------
// 2) 단어 세트 생성 (파일 없이 생성)
// ---------------------------------------
router.post("/sets", authMiddleware, adminOnly, async (req, res) => {
  const { title } = req.body;
  const adminId = req.user.id;

  if (!title?.trim()) {
    return res.status(400).json({ message: "세트 이름을 입력하세요." });
  }

  const [result] = await pool.execute(
    "INSERT INTO WordSets (userId, setTitle) VALUES (?, ?)",
    [adminId, title.trim()]
  );

  res.json({ message: "세트 생성 완료!", setId: result.insertId });
});

// ---------------------------------------
// 3) 단어 세트 삭제
// ---------------------------------------
router.delete("/sets/:id", authMiddleware, adminOnly, async (req, res) => {
  const { id } = req.params;

  await pool.execute("DELETE FROM WordSets WHERE id = ?", [id]);

  res.json({ message: "세트 삭제 완료" });
});

// ---------------------------------------
// 4) 특정 세트 → 단어 목록 조회
// ---------------------------------------
router.get("/sets/:id/words", authMiddleware, adminOnly, async (req, res) => {
  const { id } = req.params;

  const [rows] = await pool.execute(
    "SELECT * FROM Words WHERE wordSetId = ?",
    [id]
  );

  res.json(rows);
});

// ---------------------------------------
// 5) 단어 추가
// ---------------------------------------
router.post("/word", authMiddleware, adminOnly, async (req, res) => {
  const { wordSetId, question, answer } = req.body;

  if (!wordSetId || !question?.trim() || !answer?.trim()) {
    return res.status(400).json({ message: "필수 값이 부족합니다." });
  }

  await pool.execute(
    "INSERT INTO Words (wordSetId, question, answer) VALUES (?, ?, ?)",
    [wordSetId, question.trim(), answer.trim()]
  );

  res.json({ message: "단어 추가 완료" });
});

// ---------------------------------------
// 6) 단어 삭제
// ---------------------------------------
router.delete("/word/:id", authMiddleware, adminOnly, async (req, res) => {
  const { id } = req.params;

  await pool.execute("DELETE FROM Words WHERE id = ?", [id]);

  res.json({ message: "단어 삭제 완료" });
});

// ---------------------------------------
// 7) 엑셀 업로드 → 단어만 파싱해서 반환 (세트 생성 X)
// ---------------------------------------
const normalizeCell = (v) =>
  String(v ?? "")
    .replace(/\r?\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const upload = multer({ storage: multer.memoryStorage() });

router.post(
  "/upload",
  authMiddleware,
  adminOnly,
  upload.single("wordFile"),
  async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ message: "엑셀 파일을 선택해주세요." });
    }

    try {
      // 엑셀 파싱
      const data = req.file.buffer;
      const wb = XLSX.read(data);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rowsRaw = XLSX.utils.sheet_to_json(ws, { defval: "" });

      const parsed = rowsRaw
        .map((r) => ({
          word: normalizeCell(r.word ?? r.question ?? ""),
          correct: normalizeCell(r.correct ?? r.answer ?? ""),
        }))
        .filter((r) => r.word && r.correct);

      if (parsed.length === 0) {
        return res.status(400).json({
          message: "유효한 단어 목록이 없습니다. (word, correct 필요)",
        });
      }

      // 🔥 세트 생성 절대 하지 않음 → 단어 리스트만 반환
      return res.json({
        message: "엑셀 분석 성공",
        words: parsed,
      });

    } catch (err) {
      console.error("엑셀 파싱 오류:", err);
      return res.status(500).json({ message: "엑셀 파일 처리 오류" });
    }
  }
);

// ---------------------------------------
// 8) 단어 수정
// ---------------------------------------
router.put("/word/:id", authMiddleware, adminOnly, async (req, res) => {
  const { id } = req.params;
  const { question, answer } = req.body;

  await pool.execute(
    "UPDATE Words SET question = ?, answer = ? WHERE id = ?",
    [question, answer, id]
  );

  res.json({ message: "단어 수정 완료" });
});

module.exports = router;
