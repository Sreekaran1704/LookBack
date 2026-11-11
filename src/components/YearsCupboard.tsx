import { useMemo } from 'react';
import { Text } from 'react-native';
import type { Entry } from '../data';
import { groupByYear, parseLocalDate } from '../lib/dates';
import { useTheme } from '../theme';
import { useBookFlight } from './BookFlight';
import { BookSpine, spineSize } from './scrapbook/BookSpine';
import { Buddy } from './scrapbook/Buddy';
import { BOOK_GAP, CUPBOARD_FRAME, Cupboard, SHELF_INSET } from './scrapbook/Cupboard';
import { DropIn } from './scrapbook/DropIn';

/**
 * Every year's diary standing in the wooden cupboard, oldest left to newest right, the bunny as a
 * bookend. Tapping a spine pulls the book out (BookFlight) and opens that year. Used on home and on
 * the Years page.
 */
export function YearsCupboard({ entries, today, width, dropFrom = 0 }: { entries: Entry[]; today: string; width: number; dropFrom?: number }) {
  const theme = useTheme();
  const { colors, spacing, scrap, typography, sizes } = theme;
  const flight = useBookFlight();
  const years = useMemo(() => groupByYear(entries), [entries]);
  const thisYear = theme.year(parseLocalDate(today).year);
  // The diary as it appears once pulled out (the flying cover), and the books on the shelves.
  const albumW = (width - spacing.xl) / scrap.collageColumns;
  const shelfW = width - CUPBOARD_FRAME * 2 - SHELF_INSET * 2;
  // Oldest on the left, newest on the right, as you would shelve them; a shelf fills before the next.
  const shelves = useMemo(() => {
    const out: (typeof years)[] = [[]];
    let used = 0;
    for (const group of [...years].reverse()) {
      const w = spineSize(group.year, sizes.spineMax).width + BOOK_GAP;
      // Leave room for the bunny bookend at the end of the shelf.
      if (used + w > shelfW - sizes.buddySmall && (out[out.length - 1]?.length ?? 0) > 0) {
        out.push([]);
        used = 0;
      }
      out[out.length - 1]?.push(group);
      used += w;
    }
    return out;
  }, [years, sizes.spineMax, sizes.buddySmall, shelfW]);

  if (years.length === 0) {
    return <Text style={[typography.caption, { color: colors.onDeskMuted }]}>Nothing here yet. Add today&apos;s moment.</Text>;
  }
  return (
    <Cupboard
      width={width}
      shelves={shelves.map((shelf) =>
        shelf.map((group, i) => {
          const age = parseLocalDate(today).year - group.year;
          return (
            <DropIn key={group.year} index={i + dropFrom}>
              <BookSpine
                year={group.year}
                count={group.entries.length}
                age={age}
                maxHeight={sizes.spineMax}
                hidden={flight.flying === group.year}
                onPress={(frame) => flight.fly({ year: group.year, count: group.entries.length, age, width: albumW, spineMax: sizes.spineMax, frame })}
              />
            </DropIn>
          );
        }),
      )}
      decor={<Buddy mood="happy" size={sizes.buddySmall} entrance={false} accent={thisYear.primary} />}
    />
  );
}
