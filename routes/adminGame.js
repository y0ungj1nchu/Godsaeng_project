/**
 * 관리자 단어 게임 관리 API (ROLE=ADMIN 전용)
 */

const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const { authMiddleware, adminOnly } = require("../middleware/auth");
const multer = require("multer");
const XLSX = require("xlsx");

/* ================================================================
   1) 관리자 단어 세트 목록 조회 (ADMIN이 만든 세트만)
================================================================ */
router.get("/sets", authMiddleware, adminOnly, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT 
          WordSets.id, 
          WordSets.setTitle, 
          WordSets.userId, 
          WordSets.createdAt,
          Users.nickname,
          Users.role
       FROM WordSets
       JOIN Users ON Users.id = WordSets.userId
       WHERE Users.role = 'ADMIN'
       ORDER BY WordSets.createdAt DESC`
    );

    res.json(rows);
  } catch (err) {
    console.error("관리자 단어세트 조회 오류:", err);
    res.status(500).json({ message: "단어 세트 조회 실패" });
  }
});

/* ================================================================
   2) 단어 세트 생성 (관리자용)
================================================================ */
router.post("/sets", authMiddleware, adminOnly, async (req, res) => {
  const { title } = req.body;
  const adminId = req.user.id;

  if (!title?.trim()) {
    return res.status(400).json({ message: "세트 이름을 입력하세요." });
  }

  try {
    const [result] = await pool.execute(
      `INSERT INTO WordSets (userId, setTitle) VALUES (?, ?)`,
      [adminId, title.trim()]
    );

    res.json({ message: "세트 생성 완료", setId: result.insertId });
  } catch (err) {
    console.error("세트 생성 오류:", err);
    res.status(500).json({ message: "세트 생성 실패" });
  }
});

/* ================================================================
   3) 관리자 단어 세트 삭제 (ADMIN이 만든 세트인지 확인)
================================================================ */
router.delete("/sets/:id", authMiddleware, adminOnly, async (req, res) => {
  const { id } = req.params;

  try {
    const [setInfo] = await pool.execute(
      `SELECT Users.role
       FROM WordSets
       JOIN Users ON Users.id = WordSets.userId
       WHERE WordSets.id = ?`,
      [id]
    );

    if (setInfo.length === 0) {
      return res.status(404).json({ message: "세트를 찾을 수 없습니다." });
    }

    if (setInfo[0].role !== "ADMIN") {
      return res.status(403).json({ message: "관리자 세트만 삭제 가능합니다." });
    }

    await pool.execute("DELETE FROM WordSets WHERE id = ?", [id]);

    res.json({ message: "세트 삭제 완료" });
  } catch (err) {
    console.error("세트 삭제 오류:", err);
    res.status(500).json({ message: "세트 삭제 실패" });
  }
});

/* ================================================================
   4) 특정 세트 → 단어 목록 조회 (ADMIN 세트만 허용)
================================================================ */
router.get("/sets/:id/words", authMiddleware, adminOnly, async (req, res) => {
  const { id } = req.params;

  try {
    const [setInfo] = await pool.execute(
      `SELECT Users.role
       FROM WordSets
       JOIN Users ON Users.id = WordSets.userId
       WHERE WordSets.id = ?`,
      [id]
    );

    if (setInfo.length === 0) {
      return res.status(404).json({ message: "세트 찾을 수 없음" });
    }

    if (setInfo[0].role !== "ADMIN") {
      return res.status(403).json({ message: "관리자 세트만 조회할 수 있음" });
    }

    const [rows] = await pool.execute(
      `SELECT id, wordSetId, question, answer 
       FROM Words WHERE wordSetId = ?`,
      [id]
    );

    res.json(rows);
  } catch (err) {
    console.error("단어 조회 오류:", err);
    res.status(500).json({ message: "단어 조회 실패" });
  }
});

/* ================================================================
   5) 단어 추가 (ADMIN 세트인지 체크)
================================================================ */
router.post("/word", authMiddleware, adminOnly, async (req, res) => {
  const { wordSetId, question, answer } = req.body;

  if (!wordSetId || !question?.trim() || !answer?.trim()) {
    return res.status(400).json({ message: "필수 값이 부족합니다." });
  }

  try {
    const [setInfo] = await pool.execute(
      `SELECT Users.role
       FROM WordSets
       JOIN Users ON Users.id = WordSets.userId
       WHERE WordSets.id = ?`,
      [wordSetId]
    );

    if (setInfo.length === 0) {
      return res.status(404).json({ message: "세트 없음" });
    }

    if (setInfo[0].role !== "ADMIN") {
      return res.status(403).json({ message: "관리자 세트에만 단어 추가 가능" });
    }

    await pool.execute(
      `INSERT INTO Words (wordSetId, question, answer) VALUES (?, ?, ?)`,
      [wordSetId, question.trim(), answer.trim()]
    );

    res.json({ message: "단어 추가 완료" });
  } catch (err) {
    console.error("단어 추가 오류:", err);
    res.status(500).json({ message: "단어 추가 실패" });
  }
});

/* ================================================================
   6) 단어 삭제 (ADMIN 세트인지 확인)
================================================================ */
router.delete("/word/:id", authMiddleware, adminOnly, async (req, res) => {
  const { id } = req.params;

  try {
    // 해당 단어의 세트가 ADMIN 세트인지 확인
    const [check] = await pool.execute(
      `SELECT Users.role
       FROM Words
       JOIN WordSets ON WordSets.id = Words.wordSetId
       JOIN Users ON Users.id = WordSets.userId
       WHERE Words.id = ?`,
      [id]
    );

    if (check.length === 0) {
      return res.status(404).json({ message: "단어 없음" });
    }

    if (check[0].role !== "ADMIN") {
      return res
        .status(403)
        .json({ message: "관리자 세트의 단어만 삭제할 수 있습니다." });
    }

    await pool.execute("DELETE FROM Words WHERE id = ?", [id]);

    res.json({ message: "단어 삭제 완료" });
  } catch (err) {
    console.error("단어 삭제 오류:", err);
    res.status(500).json({ message: "단어 삭제 실패" });
  }
});

/* ================================================================
   7) 엑셀 업로드 → 단어만 파싱해서 반환 (세트 생성 절대 안함)
================================================================ */
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
      return res.status(400).json({ message: "엑셀 파일을 업로드하세요." });
    }

    try {
      const wb = XLSX.read(req.file.buffer);
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
          message: "유효한 단어가 없습니다. (word, correct 필요)",
        });
      }

      res.json({ message: "엑셀 분석 성공", words: parsed });
    } catch (err) {
      console.error("엑셀 파싱 오류:", err);
      res.status(500).json({ message: "엑셀 파일 처리 실패" });
    }
  }
);

/* ================================================================
   8) 단어 수정 (ADMIN 세트 확인)
================================================================ */
router.put("/word/:id", authMiddleware, adminOnly, async (req, res) => {
  const { id } = req.params;
  const { question, answer } = req.body;

  try {
    const [check] = await pool.execute(
      `SELECT Users.role
       FROM Words
       JOIN WordSets ON WordSets.id = Words.wordSetId
       JOIN Users ON Users.id = WordSets.userId
       WHERE Words.id = ?`,
      [id]
    );

    if (check.length === 0) {
      return res.status(404).json({ message: "단어 없음" });
    }

    if (check[0].role !== "ADMIN") {
      return res.status(403).json({
        message: "관리자 세트에 속한 단어만 수정할 수 있습니다.",
      });
    }

    await pool.execute(
      `UPDATE Words SET question = ?, answer = ? WHERE id = ?`,
      [question.trim(), answer.trim(), id]
    );

    res.json({ message: "단어 수정 완료" });
  } catch (err) {
    console.error("단어 수정 오류:", err);
    res.status(500).json({ message: "단어 수정 실패" });
  }
});

module.exports = router;
