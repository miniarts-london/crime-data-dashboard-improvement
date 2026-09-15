'use client';

import { FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import type { SelectChangeEvent } from '@mui/material/Select';

interface FilterOption {
  value: string;
  label: string;
}

interface FilterSelectProps {
  label: string;
  value: string | null;
  options: FilterOption[];
  onChange: (value: string | null) => void;
}

export default function FilterSelect({
  label,
  value,
  options,
  onChange,
}: FilterSelectProps) {
  const handleChange = (event: SelectChangeEvent<string>) => {
    onChange(event.target.value || null);
  };

  return (
    <FormControl fullWidth size="small" disabled={options.length === 0}>
      <InputLabel id={`${label}-filter-label`}>{label}</InputLabel>
      <Select
        labelId={`${label}-filter-label`}
        label={label}
        value={value ?? ''}
        onChange={handleChange}
      >
        <MenuItem value="">All</MenuItem>
        {options.map((option) => (
          <MenuItem key={option.value} value={option.value}>
            {option.label}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}
