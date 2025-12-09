/**
 * 갓생 제조기 - 순공시간 (Study Log) 관리 API 라우터
 * - 스톱워치 시작 및 종료, 학습 기록 조회 + 통계 API
 */

const express = require("express");
const pool = require("../config/db");
const { authMiddleware } = require("../middleware/auth");
const { updateExpAndCheckLevelUp } = require("../utils/characterUtils");
const router = express.Router();

/* ==================================================================== */
/*  [POST] /api/study/start : 공부 시작 (categoryId 기반)               */
/* ==================================================================== */
router.post("/start", authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const { categoryId } = req.body;

  if (!categoryId) {
    return res.status(400).json({ message: "categoryId는 필수입니다." });
  }

  try {
    const [existing] = await pool.execute(
      "SELECT id FROM StudyLogs WHERE userId = ? AND endTime IS NULL",
      [userId]
    );

    if (existing.length > 0) {
      return res.status(409).json({
        message: "이미 시작된 기록이 있습니다. 종료 후 다시 시작하세요.",
      });
    }

    const sql = `
      INSERT INTO StudyLogs (userId, categoryId, startTime)
      VALUES (?, ?, NOW())
    `;

    const [result] = await pool.execute(sql, [userId, categoryId]);

    res.status(201).json({
      logId: result.insertId,
      message: "공부 시간을 시작했습니다.",
    });
  } catch (error) {
    console.error("공부 시작 오류:", error);
    res.status(500).json({ message: "서버 오류 발생" });
  }
});

/* ==================================================================== */
/*  [PUT] /api/study/stop/:logId : 공부 종료 + duration 계산            */
/* ==================================================================== */
router.put("/stop/:logId", authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const logId = req.params.logId;

  let connection;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [rows] = await connection.execute(
      `
        SELECT startTime 
        FROM StudyLogs
        WHERE id = ? AND userId = ? AND endTime IS NULL
      `,
      [logId, userId]
    );

    if (rows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: "진행 중인 기록 없음" });
    }

    const startTime = new Date(rows[0].startTime);
    const endTime = new Date();
    const durationSeconds = Math.floor((endTime - startTime) / 1000);

    if (durationSeconds < 5) {
      await connection.rollback();
      return res.json({
        message: "5초 미만 기록은 저장되지 않습니다.",
        durationSeconds: 0,
      });
    }

    await connection.execute(
      `
        UPDATE StudyLogs
        SET endTime = NOW(),
            duration = TIMESTAMPDIFF(SECOND, startTime, NOW())
        WHERE id = ? AND userId = ?
      `,
      [logId, userId]
    );

    const [updated] = await connection.execute(
      "SELECT duration FROM StudyLogs WHERE id = ?",
      [logId]
    );

    const saved = updated[0].duration;
    const studyMin = Math.floor(saved / 60);

    let levelUpInfo = null;
if (studyMin > 0) {
  levelUpInfo = await updateExpAndCheckLevelUp(userId, studyMin, connection);
}

// 🔔 레벨업 발생 시 알림 보내기
if (levelUpInfo?.levelUpOccurred) {
  const { newLevel } = levelUpInfo;

  await createNotification(
    userId,
    "level_up",
    "🎉 캐릭터 레벨업!",
    `캐릭터가 ${newLevel} 레벨이 되었습니다!`
  );
}


    await connection.commit();

    res.json({
      message: "공부 기록이 저장되었습니다.",
      durationSeconds: saved,          // 🔥 초 단위
    });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error("공부 종료 오류:", error);
    res.status(500).json({ message: "서버 오류" });
  } finally {
    if (connection) connection.release();
  }
});

/* ==================================================================== */
/*  [GET] /api/study/summary : 오늘/이번주 공부 시간(초 단위)          */
/* ==================================================================== */
router.get("/summary", authMiddleware, async (req, res) => {
  const userId = req.user.id;

  try {
    const nowKST = new Date(Date.now() + 9 * 3600 * 1000);
    const today = nowKST.toISOString().split("T")[0];

    const dow = nowKST.getUTCDay();
    const offset = dow === 0 ? 6 : dow - 1;
    const monday = new Date(nowKST);
    monday.setUTCDate(nowKST.getUTCDate() - offset);
    const weekStart = monday.toISOString().split("T")[0];

    const [todayRows] = await pool.execute(
      `
        SELECT SUM(duration) AS total
        FROM StudyLogs
        WHERE userId = ? AND DATE(startTime) = ?
      `,
      [userId, today]
    );

    const [weekRows] = await pool.execute(
      `
        SELECT SUM(duration) AS total
        FROM StudyLogs
        WHERE userId = ? AND DATE(startTime) >= ?
      `,
      [userId, weekStart]
    );

    res.json({
      today: todayRows[0].total || 0,  // 🔥 초 반환
      week: weekRows[0].total || 0,    // 🔥 초 반환
    });
  } catch (error) {
    console.error("요약 오류:", error);
    res.status(500).json({ message: "서버 오류" });
  }
});

/* ==================================================================== */
/*  [GET] /api/study/current : 진행 중 세션 조회                        */
/* ==================================================================== */
router.get("/current", authMiddleware, async (req, res) => {
  const userId = req.user.id;

  try {
    const [rows] = await pool.execute(
      `
        SELECT id, categoryId, startTime
        FROM StudyLogs
        WHERE userId = ? AND endTime IS NULL
        ORDER BY startTime DESC LIMIT 1
      `,
      [userId]
    );

    if (rows.length === 0) {
      return res.json({ activeSession: null });
    }

    res.json({
      activeSession: {
        logId: rows[0].id,
        categoryId: rows[0].categoryId,
        startTime: rows[0].startTime,
      },
    });
  } catch (error) {
    console.error("current 오류:", error);
    res.status(500).json({ message: "서버 오류" });
  }
});

/* ==================================================================== */
/*  [GET] /api/study/stats/today : 오늘 카테고리별 시간(초 단위)       */
/* ==================================================================== */
router.get("/stats/today", authMiddleware, async (req, res) => {
  const userId = req.user.id;

  try {
    const today = new Date(Date.now() + 9 * 3600 * 1000)
      .toISOString()
      .split("T")[0];

    const sql = `
      SELECT c.categoryName, SUM(s.duration) AS sec
      FROM StudyLogs s
      JOIN StudyCategories c ON s.categoryId = c.id
      WHERE s.userId = ? AND DATE(s.startTime) = ?
      GROUP BY s.categoryId
      ORDER BY categoryName ASC
    `;

    const [rows] = await pool.execute(sql, [userId, today]);

    res.json({
      labels: rows.map(r => r.categoryName),
      seconds: rows.map(r => r.sec || 0),    // 🔥 초 단위 반환
    });
  } catch (err) {
    console.error("오늘 통계 오류:", err);
    res.status(500).json({ message: "오늘 통계 조회 실패" });
  }
});

/* ==================================================================== */
/*  [GET] /api/study/stats/last7 : 최근 7일 공부시간(초 단위)          */
/* ==================================================================== */
router.get("/stats/last7", authMiddleware, async (req, res) => {
  const userId = req.user.id;

  try {
    // 🔥 지금 서버 시간 사용 (KST 가정)
    const today = new Date();

    // 🔥 최근 7일 날짜 라벨(YYYY-MM-DD) 생성
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);

      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");

      days.push(`${yyyy}-${mm}-${dd}`);
    }

    // 🔥 SQL (시간대 변환 없음)
    const sql = `
      SELECT DATE(startTime) AS date, SUM(duration) AS sec
      FROM StudyLogs
      WHERE userId = ?
        AND DATE(startTime) BETWEEN ? AND ?
      GROUP BY DATE(startTime)
      ORDER BY DATE(startTime)
    `;

    const [rows] = await pool.execute(sql, [userId, days[0], days[6]]);

    // 🔥 날짜 - 시간 매핑
    const map = {};
    rows.forEach(r => {
      const dateKey = r.date.toISOString().split("T")[0]; // ← DATE 필드 안전 변환
      map[dateKey] = r.sec || 0;
    });

    // 🔥 days 배열 순서에 맞춰 값 생성
    const seconds = days.map(d => map[d] || 0);

    res.json({ labels: days, seconds });
  } catch (err) {
    console.error("7일 통계 오류:", err);
    res.status(500).json({ message: "최근 7일 통계 조회 실패" });
  }
});


module.exports = router;
