/** Segmented lesson progress — Duolingo-style top bar */

export default function QuizProgressBar({ current, total, results = [] }) {
  if (!total) return null;

  return (
    <div className="mb-3">
      <div className="flex gap-1">
        {Array.from({ length: total }, (_, i) => {
          const r = results[i];
          let bg = "bg-rule";
          if (r?.correct === true) bg = "bg-go";
          else if (r?.correct === false) bg = "bg-flag";
          else if (i === current) bg = "bg-jersey";
          return (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-colors duration-200 ${bg}`}
            />
          );
        })}
      </div>
      <p className="font-data text-[10px] text-ink-soft mt-1.5 text-center">
        {current + 1} of {total}
      </p>
    </div>
  );
}
