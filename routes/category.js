const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const {authMiddleware} = require("../middleware/auth");

// =============================================================
// 1) 카테고리 목록 조회 (사용자별)
// =============================================================
router.get("/", authMiddleware, async (req, res) => {
  const userId = req.user.id;

  try {
    const [rows] = await pool.query(
      "SELECT id, categoryName, createdAt FROM StudyCategories WHERE userId = ? ORDER BY id DESC",
      [userId]
    );

    res.json(rows);
  } catch (err) {
    console.error("카테고리 조회 오류:", err);
    res.status(500).json({ message: "카테고리 조회 실패" });
  }
});


// =============================================================
// 2) 카테고리 추가
// =============================================================
router.post("/", authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const { categoryName } = req.body;

  if (!categoryName || !categoryName.trim()) {
    return res.status(400).json({ message: "카테고리명을 입력하세요." });
  }

  try {
    const [result] = await pool.query(
      "INSERT INTO StudyCategories (userId, categoryName) VALUES (?, ?)",
      [userId, categoryName.trim()]
    );

    res.json({
      message: "카테고리 추가 완료",
      id: result.insertId,
      categoryName
    });
  } catch (err) {
    console.error("카테고리 추가 오류:", err);
    res.status(500).json({ message: "카테고리 추가 실패" });
  }
});


// =============================================================
// 3) 카테고리 이름 수정
// =============================================================
router.put("/:id", authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const categoryId = req.params.id;
  const { categoryName } = req.body;

  if (!categoryName || !categoryName.trim()) {
    return res.status(400).json({ message: "카테고리를 입력하세요." });
  }

  try {
    const [result] = await pool.query(
      "UPDATE StudyCategories SET categoryName = ? WHERE id = ? AND userId = ?",
      [categoryName.trim(), categoryId, userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "카테고리를 찾을 수 없습니다." });
    }

    res.json({ message: "카테고리 수정 완료" });
  } catch (err) {
    console.error("카테고리 수정 오류:", err);
    res.status(500).json({ message: "카테고리 수정 실패" });
  }
});


// =============================================================
// 4) 카테고리 삭제
// =============================================================
router.delete("/:id", authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const categoryId = req.params.id;

  try {
    const [result] = await pool.query(
      "DELETE FROM StudyCategories WHERE id = ? AND userId = ?",
      [categoryId, userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "카테고리를 찾을 수 없습니다." });
    }

    res.json({ message: "카테고리 삭제 완료" });
  } catch (err) {
    console.error("카테고리 삭제 오류:", err);
    res.status(500).json({ message: "카테고리 삭제 실패" });
  }
});

module.exports = router;
