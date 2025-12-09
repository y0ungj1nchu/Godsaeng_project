-- ============================
-- 1) WordSets 생성
-- ============================
INSERT INTO WordSets (userId, setTitle) VALUES 
(1, 'week1'),
(1, 'week2'),
(1, 'week3'),
(1, 'week4'),
(1, 'week5'),
(1, 'week6'),
(1, 'week7');

-- 자동 증가된 id 변수로 저장
SET @week1 := (SELECT id FROM WordSets WHERE setTitle='week1');
SET @week2 := (SELECT id FROM WordSets WHERE setTitle='week2');
SET @week3 := (SELECT id FROM WordSets WHERE setTitle='week3');
SET @week4 := (SELECT id FROM WordSets WHERE setTitle='week4');
SET @week5 := (SELECT id FROM WordSets WHERE setTitle='week5');
SET @week6 := (SELECT id FROM WordSets WHERE setTitle='week6');
SET @week7 := (SELECT id FROM WordSets WHERE setTitle='week7');

-- ============================
-- 2) Words (각 10개, 중복 없음)
-- ============================

-- ---------- week1 ----------
INSERT INTO Words (wordSetId, question, answer) VALUES
(@week1, 'apple', '사과'),
(@week1, 'banana', '바나나'),
(@week1, 'cat', '고양이'),
(@week1, 'dog', '개'),
(@week1, 'happy', '행복한'),
(@week1, 'run', '달리다'),
(@week1, 'blue', '파란'),
(@week1, 'book', '책'),
(@week1, 'table', '테이블'),
(@week1, 'friend', '친구');

-- ---------- week2 ----------
INSERT INTO Words (wordSetId, question, answer) VALUES
(@week2, 'orange', '오렌지'),
(@week2, 'grape', '포도'),
(@week2, 'fish', '물고기'),
(@week2, 'strong', '강한'),
(@week2, 'city', '도시'),
(@week2, 'computer', '컴퓨터'),
(@week2, 'flower', '꽃'),
(@week2, 'family', '가족'),
(@week2, 'write', '쓰다'),
(@week2, 'swim', '수영하다');

-- ---------- week3 ----------
INSERT INTO Words (wordSetId, question, answer) VALUES
(@week3, 'sun', '태양'),
(@week3, 'moon', '달'),
(@week3, 'plane', '비행기'),
(@week3, 'car', '자동차'),
(@week3, 'cold', '추운'),
(@week3, 'season', '계절'),
(@week3, 'rain', '비'),
(@week3, 'king', '왕'),
(@week3, 'child', '아이'),
(@week3, 'sports', '스포츠');

-- ---------- week4 ----------
INSERT INTO Words (wordSetId, question, answer) VALUES
(@week4, 'idea', '아이디어'),
(@week4, 'problem', '문제'),
(@week4, 'solution', '해결책'),
(@week4, 'create', '창조하다'),
(@week4, 'listen', '듣다'),
(@week4, 'color', '색'),
(@week4, 'history', '역사'),
(@week4, 'future', '미래'),
(@week4, 'movie', '영화'),
(@week4, 'song', '노래');

-- ---------- week5 ----------
INSERT INTO Words (wordSetId, question, answer) VALUES
(@week5, 'health', '건강'),
(@week5, 'doctor', '의사'),
(@week5, 'hospital', '병원'),
(@week5, 'art', '예술'),
(@week5, 'culture', '문화'),
(@week5, 'travel', '여행'),
(@week5, 'market', '시장'),
(@week5, 'price', '가격'),
(@week5, 'money', '돈'),
(@week5, 'customer', '고객');

-- ---------- week6 ----------
-- ※ 중복되던 energy 제거하고 새 단어 'discover' 추가
INSERT INTO Words (wordSetId, question, answer) VALUES
(@week6, 'animal', '동물'),
(@week6, 'forest', '숲'),
(@week6, 'island', '섬'),
(@week6, 'language', '언어'),
(@week6, 'message', '메시지'),
(@week6, 'dream', '꿈'),
(@week6, 'team', '팀'),
(@week6, 'leader', '리더'),
(@week6, 'goal', '목표'),
(@week6, 'discover', '발견하다');

-- ---------- week7 ----------
INSERT INTO Words (wordSetId, question, answer) VALUES
(@week7, 'time', '시간'),
(@week7, 'minute', '분'),
(@week7, 'start', '시작하다'),
(@week7, 'win', '이기다'),
(@week7, 'open', '열다'),
(@week7, 'push', '밀다'),
(@week7, 'break', '부수다'),
(@week7, 'send', '보내다'),
(@week7, 'clean', '청소하다'),
(@week7, 'quick', '빠른');
