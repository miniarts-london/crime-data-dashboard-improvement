'use client';

import { memo } from 'react';
import { Box, Chip, Typography, Paper } from '@mui/material';
import type { HistoryEntry } from '@/lib/usePostcodeHistory';
import FilterSelect from './select';

export interface FilterOption {
  value: string;
  label: string;
}

interface PostcodeHistoryProps {
  entries: HistoryEntry[];
  onSelect: (postcode: string) => void;
  onRemove: (postcode: string) => void;
  categoryOptions: FilterOption[];
  statusOptions: FilterOption[];
  category: string | null;
  status: string | null;
  onCategoryChange: (value: string | null) => void;
  onStatusChange: (value: string | null) => void;
}

function PostcodeHistory({
  entries,
  onSelect,
  onRemove,
  categoryOptions,
  statusOptions,
  category,
  status,
  onCategoryChange,
  onStatusChange,
}: PostcodeHistoryProps) {
  return (
    <Paper variant="outlined" sx={{ height: '100%' }}>
      <Box sx={{ p: 2, textAlign: 'left' }}>
        <Typography variant="overline" color="primary" component="p" sx={{ m: 0 }}>
          Searched postcodes
        </Typography>
        {entries.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            Postcodes you search will appear here.
          </Typography>
        ) : (
          <Box
            component="ul"
            sx={{
              display: 'flex',
              flexDirection: { xs: 'row', md: 'column' },
              alignItems: 'flex-start',
              m: 0,
              mt: 1,
              p: 0,
              listStyle: 'none',
              gap: 1,
              flexWrap: { xs: 'wrap', md: 'nowrap' },
              width: { xs: '100%', md: 'fit-content' },
            }}
          >
            {entries.map((entry) => (
              <Box component="li" key={entry.postcode} sx={{ width: 'auto', maxWidth: '100%' }}>
                <Chip
                  label={entry.postcode}
                  size="small"
                  variant="outlined"
                  onClick={() => onSelect(entry.postcode)}
                  onDelete={() => onRemove(entry.postcode)}
                />
              </Box>
            ))}
          </Box>
        )}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 2 }}>
          <Typography variant="overline" color="primary" component="p" sx={{ m: 0 }}>
            Filters
          </Typography>
          <FilterSelect
            label="Category"
            value={category}
            options={categoryOptions}
            onChange={onCategoryChange}
          />
          <FilterSelect
            label="Status"
            value={status}
            options={statusOptions}
            onChange={onStatusChange}
          />
        </Box>
      </Box>
    </Paper>
  );
}

export default memo(PostcodeHistory);
