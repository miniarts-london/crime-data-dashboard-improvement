'use client';

import { Box, Typography, Grid, AppBar, Paper, Toolbar, LinearProgress, Chip, Stack } from "@mui/material";
import SearchBar from "./SearchBar";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { InitialParams, QuickFilters } from "@/types/dashboard";
import { parsePostcodesInput } from "@/lib/postcodes";
import { currentMonth } from "@/lib/dateRange";
import Header from "./Header";
import { useColorMode } from "./ContextRoot/Providers";
import { clearQueryString, updateQueryString } from "@/components/Helper";
import { categoryLabel } from "@/lib/theme";
import SnackBar from "./snackBar";
import CrimeOverview from "./CrimeOverview";
import CrimeTable from "./CrimeTable";
import PostcodeHistory from "./PostcodeHistory";
import { usePostcodeHistory } from "@/lib/usePostcodeHistory";
import { useCrimes } from "@/lib/useCrimes";

const CrimeMap = dynamic(() => import("./CrimeMap"), {
  ssr: false,
  loading: () => (
    <Box sx={{ height: 360, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Typography variant="body2" color="text.secondary">Loading map…</Typography>
    </Box>
  ),
});

export default function Dashboard({ initialParams }: { initialParams: InitialParams }) {
  const { mode, toggleColorMode } = useColorMode();
  const history = usePostcodeHistory();

  const [postcodes, setPostcodes] = useState<string[]>(initialParams.postcodes);
  const [from, setFrom] = useState(initialParams.from);
  const [to, setTo] = useState(initialParams.to);
  const [notice, setNotice] = useState('');
  const [quickFilters, setQuickFilters] = useState<QuickFilters>({ postcode: null, category: null, outcome: null });
  const didAutoSearch = useRef(false);

  const handleSearchStart = useCallback((pcs: string[], searchFrom: string, searchTo: string) => {
    updateQueryString(pcs, searchFrom, searchTo);
    setQuickFilters({ postcode: null, category: null, outcome: null });
  }, []);

  const { crimes, searchPoints, loading, progress, error, search: runSearch, reset: resetCrimes, clearError } =
    useCrimes({ onSearchStart: handleSearchStart, onGeocoded: history.record });

  const filteredCrimes = useMemo(
    () =>
      crimes.filter(
        (c) =>
          (!quickFilters.postcode || c.postcode === quickFilters.postcode) &&
          (!quickFilters.category || c.category === quickFilters.category) &&
          (!quickFilters.outcome || c.outcome === quickFilters.outcome)
      ),
    [crimes, quickFilters]
  );

  const stats = useMemo(() => {
    const categoryCounts: Record<string, number> = {};
    const outcomeCounts: Record<string, number> = {};
    filteredCrimes.forEach((c) => {
      categoryCounts[c.category] = (categoryCounts[c.category] || 0) + 1;
      outcomeCounts[c.outcome] = (outcomeCounts[c.outcome] || 0) + 1;
    });
    return { total: filteredCrimes.length, categoryCounts, outcomeCounts };
  }, [filteredCrimes]);

  // Stable, memoized so it doesn't create a brand-new array (and defeat
  // SearchBar's React.memo) on every render, the way .map() would inline.
  const postcodeOptions = useMemo(
    () => history.entries.map((e) => e.postcode),
    [history.entries]
  );

  const categoryOptions = useMemo(() => {
    const labels = new Map<string, string>();
    for (const crime of crimes) {
      if (!labels.has(crime.category)) labels.set(crime.category, categoryLabel(crime.category));
    }
    return [...labels.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [crimes]);

  const statusOptions = useMemo(() => {
    const seen = new Set<string>();
    for (const crime of crimes) seen.add(crime.outcome);
    return [...seen]
      .sort((a, b) => a.localeCompare(b))
      .map((value) => ({ value, label: value }));
  }, [crimes]);

  useEffect(() => {
    if (didAutoSearch.current) return;
    didAutoSearch.current = true;
    if (initialParams.postcodes.length > 0) {
      queueMicrotask(() => {
        runSearch(initialParams.postcodes, initialParams.from, initialParams.to);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearchSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      const { valid, invalid } = parsePostcodesInput(postcodes.join(','));
      if (valid.length === 0) {
        setNotice('Enter at least one valid UK postcode to search.');
        return;
      }
      setNotice(invalid.length ? `Ignored invalid postcode(s): ${invalid.join(', ')}` : '');
      // Reflect the validated, deduped, normalized set back into the chips.
      setPostcodes(valid);
      const useFrom = from || currentMonth();
      const useTo = to || currentMonth();
      setFrom(useFrom);
      setTo(useTo);
      runSearch(valid, useFrom, useTo);
    },
    [postcodes, from, to, runSearch]
  );

  const handleReset = useCallback(() => {
    resetCrimes();
    const month = currentMonth();
    setPostcodes([]);
    setFrom(month);
    setTo(month);
    setNotice('');
    setQuickFilters({ postcode: null, category: null, outcome: null });
    history.clear();
    clearQueryString();
  }, [resetCrimes, history.clear]);


  const activeFilterChips = (Object.entries(quickFilters) as [keyof QuickFilters, string | null][]).filter(
    ([, v]) => v
  );

  const handleQuickFilter = useCallback((field: keyof QuickFilters, value: string) => {
    setQuickFilters((prev) => ({ ...prev, [field]: prev[field] === value ? null : value }));
  }, []);

  const handleCategoryFilter = useCallback((value: string | null) => {
    setQuickFilters((prev) => ({ ...prev, category: value }));
  }, []);

  const handleStatusFilter = useCallback((value: string | null) => {
    setQuickFilters((prev) => ({ ...prev, outcome: value }));
  }, []);

  const handleHistorySelect = useCallback(
    (postcode: string) => {
      setPostcodes([postcode]);
      setNotice('');
      const useFrom = from || currentMonth();
      const useTo = to || currentMonth();
      setFrom(useFrom);
      setTo(useTo);
      runSearch([postcode], useFrom, useTo);
    },
    [from, to, runSearch]
  );

  return (
    <>
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
        <AppBar position="static" color="default" elevation={1}>
          <Toolbar sx={{ flexDirection: 'column', alignItems: 'stretch', gap: 1, py: 1.5 }}>
            <Header
              mode={mode}
              toggleColorMode={toggleColorMode}
            />
            <SearchBar
              postcodes={postcodes}
              onPostcodesChange={setPostcodes}
              postcodeOptions={postcodeOptions}
              from={from}
              onFromChange={setFrom}
              to={to}
              onToChange={setTo}
              onSubmit={handleSearchSubmit}
              onReset={handleReset}
              loading={loading}
              notice={notice}
            />
          </Toolbar>
          {loading && progress && (
            <LinearProgress 
              variant="determinate" 
              value={(progress.done / progress.total) * 100} />
          )}
          {activeFilterChips.length > 0 && (
            <Stack direction="row" spacing={1} sx={{ px: 2, py: 1, flexWrap: 'wrap' }}>
              <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center' }}>
                Filtered by:
              </Typography>
              {activeFilterChips.map(([field, value]) => (
                <Chip
                  key={field}
                  size="small"
                  label={`${field}: ${value}`}
                  onDelete={() => handleQuickFilter(field, value as string)}
                />
              ))}
            </Stack>
          )}
        </AppBar>
        <Grid container sx={{p:2, pb:0}}>
          <Grid size={{xs:12, sm:12, md:3}} sx={{p:1}}>
            <PostcodeHistory
              entries={history.entries} 
              onSelect={handleHistorySelect} 
              onRemove={history.remove}
              categoryOptions={categoryOptions}
              statusOptions={statusOptions}
              category={quickFilters.category}
              status={quickFilters.outcome}
              onCategoryChange={handleCategoryFilter}
              onStatusChange={handleStatusFilter}
            />
          </Grid>
          <Grid size={{xs:12, sm:12, md:'grow'}} sx={{ p:1 }}>
            <CrimeOverview 
              total={stats.total} 
              categoryCounts={stats.categoryCounts} 
              outcomeCounts={stats.outcomeCounts}
              onQuickFilter={handleQuickFilter}
              activeFilters={quickFilters}
            />
          </Grid>
        </Grid> 
        <Grid container sx={{p:2}}>
          <Grid size={{xs:12, sm:12, lg:6}} sx={{p:1}}>
            <Paper variant="outlined">
              <Box sx={{ p: 2, pb: 1 }}>
                <Box sx={{ p: 2, pb: 1 }}>
                  <Typography variant="overline" color="primary">
                    Crime Map
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {stats.total > 0
                      ? `${stats.total.toLocaleString()} crime${stats.total === 1 ? '' : 's'} plotted by location - click a marker for details`
                      : 'Crimes matching your search, plotted by location - click a marker for details'}
                  </Typography>
                </Box>
                <Box sx={{ height: 360, mt: 1, '& .leaflet-container': { height: '100%', width: '100%' } }}>
                  {searchPoints.length > 0 ? (
                    <CrimeMap
                      crimes={filteredCrimes}
                      searchPoints={searchPoints}
                    />
                  ) : (
                    <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Typography variant="body2" color="text.secondary">
                        No data yet - run a search above.
                      </Typography>
                    </Box>
                  )}
                </Box>
              </Box>
            </Paper>
          </Grid>
          <Grid size={{xs:12, sm:12, lg:6}} sx={{p:1}}>
            <Paper variant="outlined">
              <Box sx={{ p: 2, pb: 1 }}>
                <Typography variant="overline" color="primary">
                  Crime Table
                  </Typography>
                <Typography variant="body2" color="text.secondary">
                  Click a postcode, crime type, or outcome — in the table or the
                  breakdown above — to filter the results
                </Typography>
                <CrimeTable
                  crimes={filteredCrimes} 
                  onQuickFilter={handleQuickFilter} 
                  activeFilters={quickFilters} 
                />
              </Box>
            </Paper>
          </Grid>
        </Grid>
      </Box>
      {error && (
        <SnackBar 
          openSnackbar={Boolean(error)}
          message={error}
          handleCloseSnackbar={clearError}
        />
      )}
    </>
  );
}
