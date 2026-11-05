/**
 * Liczba z cyframi o stałej szerokości, ale bez poszerzonych separatorów.
 * W Schibsted Grotesk cecha „tnum” obejmuje też przecinek i kropkę, więc separatory
 * idą w osobnych elementach ze zwykłymi cyframi.
 */
export function Num({ children }: { children: string }) {
  return (
    <span className="tnum">
      {children.split(/(\d+)/).map((part, i) =>
        i % 2 === 1 ? (
          part
        ) : part ? (
          <span key={i} className="sep">
            {part}
          </span>
        ) : null,
      )}
    </span>
  )
}
