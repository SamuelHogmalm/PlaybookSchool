/**
 * QUIZ GENERATION LAYER — pure Question data from Play. No UI, no animation.
 */

export {
  generateFlashcardDeck,
  generateQuestions,
  questionBeatRange,
  getQuizWatchStopBeat,
  needsWatchIntro,
  watchPlaybackTargetMs,
  scoreSpot,
  scoreDrawAnswer,
  QUIZ_WATCH_SPEED,
  QUIZ_FULL_PLAY_SPEED,
  QUIZ_CATEGORIES,
  CATEGORY_ORDER,
} from "@/lib/quiz";

export { generateDailyQuizDeck, DAILY_QUIZ_CATEGORIES } from "@/lib/dailyQuiz";

export {
  questionHeadline,
  watchHeadline,
  contextHeadline,
  needsContextPhase,
  needsManualWatchStart,
} from "@/lib/quizInstructions";
