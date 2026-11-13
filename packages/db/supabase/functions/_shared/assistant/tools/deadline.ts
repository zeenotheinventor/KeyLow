// The one deadline of a kitchen tool, counted from the moment the tool starts, so the tool ends inside the time the
// turn loop gives it and not by the loop's own abort. `within` races a step against what is left of it.
export class BudgetExceeded extends Error {}

export function deadlineOf(totalMilliseconds: number) {
  const startedAt = performance.now();
  const millisecondsLeft = () => totalMilliseconds - (performance.now() - startedAt);
  // Races a step against the deadline, so a slow step ends the tool and not the turn.
  const within = <T>(work: Promise<T>): Promise<T> => {
    // The step may still end after the deadline. Its failure then has nobody to tell.
    work.catch(() => {});
    let timer: ReturnType<typeof setTimeout> | undefined;
    const cutoff = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => reject(new BudgetExceeded()), Math.max(0, millisecondsLeft()));
    });
    return Promise.race([work, cutoff]).finally(() => clearTimeout(timer));
  };
  return { millisecondsLeft, within };
}
