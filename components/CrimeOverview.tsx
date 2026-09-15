'use client';

import { Box, Paper, Typography, Grid } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { colorFor, categoryLabel, bucketFor } from '@/lib/theme';
import { useColorMode } from './ContextRoot/Providers';
import type { QuickFilters } from '@/types/dashboard';

interface BarRowProps {
  label: string;
  count: number;
  max: number;
  color: string;
  active?: boolean;
  onClick?: () => void;
}

function BarRow({ label, count, max, color, active, onClick }: BarRowProps) {
  const pct = max > 0 ? Math.max((count / max) * 100, 3) : 0;
  return (
    <Box
      component="button"
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={onClick ? `Click to filter by ${label}` : undefined}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        py: 0.4,
        px: 0,
        width: '100%',
        border: 0,
        bgcolor: active ? 'action.selected' : 'transparent',
        cursor: onClick ? 'pointer' : 'default',
        borderRadius: 1,
        textAlign: 'left',
        font: 'inherit',
        color: 'inherit',
        '&:hover': onClick ? { bgcolor: 'action.hover' } : undefined,
      }}
    >
      <Typography variant="body2" noWrap title={label} sx={{ width: 200, flexShrink: 0 }}>
        {label}
      </Typography>
      <Box sx={{ flex: 1, height: 8, bgcolor: 'action.hover', borderRadius: 4, overflow: 'hidden' }}>
        <Box sx={{ width: `${pct}%`, height: '100%', bgcolor: color, borderRadius: 4 }} />
      </Box>
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ width: 48, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}
      >
        {count.toLocaleString()}
      </Typography>
    </Box>
  );
}

interface CrimeOverviewProps {
  total: number;
  categoryCounts: Record<string, number>;
  outcomeCounts: Record<string, number>;
  onQuickFilter?: (field: keyof QuickFilters, value: string) => void;
  activeFilters?: QuickFilters;
}

export default function CrimeOverview({
  total,
  categoryCounts,
  outcomeCounts,
  onQuickFilter,
  activeFilters,
}: CrimeOverviewProps) {
  const { mode } = useColorMode();
  const theme = useTheme();
  const outcomeBarColor = theme.palette.secondary.main;

  const categoryEntries = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1]);
  const outcomeEntries = Object.entries(outcomeCounts).sort((a, b) => b[1] - a[1]);
  const maxCategory = categoryEntries[0]?.[1] || 0;
  const maxOutcome = outcomeEntries[0]?.[1] || 0;

  return (
    <Grid container spacing={2}>
      <Grid size={{sm:12, md:12, lg:'grow'}}>
        <Paper variant="outlined">
          <Box sx={{ minWidth: 110, p:2, textAlign:'center'}}>
            <Typography variant="overline" color="primary">
              Total crimes
            </Typography>
            <Typography variant="h3" sx={{ fontWeight: 700, lineHeight: 1.1 }}>
              {total.toLocaleString()}
            </Typography>
          </Box>
        </Paper>
      </Grid>
      <Grid size={{xs:12, sm:6, md:6, lg:5}}>
        <Paper>
          <Box sx={{ p:2 }}>
            <Typography variant="overline" color="primary">
              By category
            </Typography>
            {categoryEntries.length === 0 && (
              <Typography variant="body2" color="warning">
                No data yet - run a search above.
              </Typography>
            )}
            {categoryEntries.map(([cat, count]) => (
              <BarRow 
                key={cat} 
                label={categoryLabel(cat)} 
                count={count}
                max={maxCategory} 
                color={colorFor(bucketFor(cat), mode)}
                active={activeFilters?.category === cat}
                onClick={onQuickFilter ? () => onQuickFilter('category', cat) : undefined}
              />
            ))}
          </Box>
        </Paper>
      </Grid>
      <Grid size={{xs:12, sm:6, md:6, lg:5}}>
        <Paper>
          <Box sx={{ p:2}}>
            <Typography variant="overline" color="primary">
              By outcome status
            </Typography>
            {outcomeEntries.length === 0 && (
              <Typography variant="body2" color="warning">
                No data yet - run a search above.
              </Typography>
            )}
            {outcomeEntries.map(([outcome, count]) => (
              <BarRow 
                key={outcome} 
                label={outcome} 
                count={count} 
                max={maxOutcome} 
                color={outcomeBarColor}
                active={activeFilters?.outcome === outcome}
                onClick={onQuickFilter ? () => onQuickFilter('outcome', outcome) : undefined}
              />
            ))}
          </Box>
        </Paper>
      </Grid>
    </Grid>
  );
}
