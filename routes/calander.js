/**
 * 갓생 제조기 - Calendar API (SQL 기준 재작성 완성본)
 * 날짜 상세 조회 + 월 요약 기능
 */

const express = require("express");
const pool = require("../config/db");
const { authMiddleware } = require("../middleware/auth");

const router = express.Router();

/* ============================================================
   📌 1) 날짜 상세 조회 (Diary, Todos, StudyLogs)
============================================================ */
router.get("/day/:date", authMiddleware, async (req, res) => {
    const userId = req.user.id;
    const date = req.params.date; // YYYY-MM-DD

    try {
        // Diary
        const diarySql = `
            SELECT id, title, content
            FROM Diaries
            WHERE userId = ? AND diaryDate = ?
        `;
        const [diaryRows] = await pool.execute(diarySql, [userId, date]);

        // Todos
        const todoSql = `
            SELECT id, title, memo, isCompleted
            FROM Todos
            WHERE userId = ? AND dueDate = ?
            ORDER BY isCompleted ASC, createdAt DESC
        `;
        const [todoRows] = await pool.execute(todoSql, [userId, date]);

        // StudyLogs
        const studySql = `
            SELECT SUM(duration) AS totalStudy
            FROM StudyLogs
            WHERE userId = ? AND DATE(startTime) = ?
        `;
        const [studyRows] = await pool.execute(studySql, [userId, date]);
        const totalStudy = studyRows[0]?.totalStudy || 0;

        res.json({
            diary: diaryRows[0] || null,
            todos: todoRows,
            study: totalStudy
        });

    } catch (error) {
        console.error("🔥 날짜 상세 조회 오류:", error);
        res.status(500).json({ message: "서버 오류가 발생했습니다." });
    }
});


/* ============================================================
   📌 2) 월 요약 조회 (todoCount, hasDiary, totalStudy)
   GET /api/calendar/month?year=2025&month=12
============================================================ */
router.get("/month", authMiddleware, async (req, res) => {
    const userId = req.user.id;
    const { year, month } = req.query;

    if (!year || !month) {
        return res.status(400).json({ message: "year, month가 필요합니다." });
    }

    try {
        /*  
            ⚠ 매우 중요!
            ★ 날짜를 반드시 DATE_FORMAT('%Y-%m-%d') 로 통일해야
              프론트에서 ymd(d)와 정확히 일치함.
        */

        const sql = `
            SELECT 
                date,
                SUM(todoCount) AS todoCount,
                MAX(hasDiary) AS hasDiary,
                SUM(totalStudy) AS totalStudy
            FROM (
                -- 1) Todos 개수 요약
                SELECT 
                    DATE_FORMAT(dueDate, '%Y-%m-%d') AS date,
                    COUNT(*) AS todoCount,
                    0 AS hasDiary,
                    0 AS totalStudy
                FROM Todos
                WHERE userId = ? AND YEAR(dueDate) = ? AND MONTH(dueDate) = ?
                GROUP BY DATE_FORMAT(dueDate, '%Y-%m-%d')

                UNION ALL

                -- 2) Diaries 존재 여부
                SELECT
                    DATE_FORMAT(diaryDate, '%Y-%m-%d') AS date,
                    0 AS todoCount,
                    1 AS hasDiary,
                    0 AS totalStudy
                FROM Diaries
                WHERE userId = ? AND YEAR(diaryDate) = ? AND MONTH(diaryDate) = ?

                UNION ALL

                -- 3) StudyLogs 시간 요약
                SELECT
                    DATE_FORMAT(startTime, '%Y-%m-%d') AS date,
                    0 AS todoCount,
                    0 AS hasDiary,
                    SUM(duration) AS totalStudy
                FROM StudyLogs
                WHERE userId = ? AND YEAR(startTime) = ? AND MONTH(startTime) = ?
                GROUP BY DATE_FORMAT(startTime, '%Y-%m-%d')
            ) AS summary
            GROUP BY date
            ORDER BY date ASC;
        `;

        const [rows] = await pool.execute(sql, [
            userId, year, month,
            userId, year, month,
            userId, year, month
        ]);

        res.json(rows);

    } catch (error) {
        console.error("🔥 월 요약 조회 오류:", error);
        res.status(500).json({ message: "서버 오류가 발생했습니다." });
    }
});

module.exports = router;
