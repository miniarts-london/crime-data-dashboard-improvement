'use client';

import { memo, useMemo } from 'react';
import { MaterialReactTable, useMaterialReactTable, type MRT_ColumnDef } from 'material-react-table';
import { Chip, Box } from '@mui/material';
import dayjs from 'dayjs';
import { colorFor, categoryLabel, bucketFor } from '@/lib/theme';
import { useColorMode } from './ContextRoot/Providers';
import type { CrimeRecord, QuickFilters } from '@/types/dashboard';

interface CrimeTableProps {
  crimes: CrimeRecord[];
  onQuickFilter: (field: keyof QuickFilters, value: string) => void;
  activeFilters: QuickFilters;
}

function CrimeTable({ crimes, onQuickFilter, activeFilters }: CrimeTableProps) {
  const { mode } = useColorMode();

  const columns = useMemo<MRT_ColumnDef<CrimeRecord>[]>(
    () => [
      {
        accessorKey: 'postcode',
        header: 'Postcode',
        size:100,
        Cell: ({ cell }) => {
          const value = cell.getValue<string>();
          const active = activeFilters.postcode === value;
          return (
            <Box
              component="span"
              onClick={() => onQuickFilter('postcode', value)}
              title="Click to filter by this postcode"
              sx={{
                cursor: 'pointer',
                fontWeight: active ? 700 : 400,
                textDecoration: active ? 'underline' : 'none',
              }}
            >
              {value}
            </Box>
          );
        },
      },
      {
        accessorKey: 'month',
        header: 'Date',
        size:100,
        Cell: ({ cell }) => dayjs(`${cell.getValue<string>()}-01`).format('MMM YYYY'),
      },
      { accessorKey: 'street', header: 'Street' },
      {
        accessorKey: 'category',
        header: 'Crime Type',
        size:100,
        Cell: ({ cell }) => {
          const value = cell.getValue<string>();
          const active = activeFilters.category === value;
          return (
            <Chip
              size="small"
              label={categoryLabel(value)}
              onClick={() => onQuickFilter('category', value)}
              title="Click to filter by this crime type"
              sx={{
                bgcolor: colorFor(bucketFor(value), mode),
                color: '#fff',
                fontWeight: 600,
                cursor: 'pointer',
                outline: active ? '2px solid currentColor' : 'none',
                outlineOffset: '1px',
              }}
            />
          );
        },
      },
      {
        accessorKey: 'outcome',
        header: 'Outcome',
        Cell: ({ cell }) => {
          const value = cell.getValue<string>();
          const active = activeFilters.outcome === value;
          return (
            <Box
              component="span"
              onClick={() => onQuickFilter('outcome', value)}
              title="Click to filter by this outcome status"
              sx={{
                cursor: 'pointer',
                fontWeight: active ? 700 : 400,
                textDecoration: active ? 'underline' : 'none',
              }}
            >
              {value}
            </Box>
          );
        },
      },
    ],
    [activeFilters, onQuickFilter, mode]
  );

  const table = useMaterialReactTable({
    columns,
    data: crimes,
    enableColumnFilters: false,
    enableDensityToggle: false,
    enableFullScreenToggle: false,
    initialState: {
      density: 'compact',
      pagination: { pageSize: 15, pageIndex: 0 },
    },
    muiTablePaperProps: { sx: { boxShadow: 'none', height: '100%' } },
  });

  return (
    <Box sx={{ px: 1 }}>
      <MaterialReactTable table={table} />
    </Box>
  );
}

export default memo(CrimeTable);
