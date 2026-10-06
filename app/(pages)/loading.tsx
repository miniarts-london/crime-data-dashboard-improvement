import { Box, Grid, Paper, Skeleton, Stack } from '@mui/material';

// Shown by Next.js while the page's server component is rendering: on the
// first request (the route is dynamic because it reads searchParams) and on
// client-side navigation to it. It is NOT shown during a crime search - that
// runs in the browser after the page has loaded, and Dashboard shows its own
// loading state from useCrimes' `status`.
//
// The skeleton mirrors the dashboard layout, so the page doesn't jump when the
// real content replaces it.
export default function Loading() {
  return (
    <Box role="status" aria-label="Loading dashboard" sx={{ display: 'flex', flexDirection: 'column' }}>
      {/* Header and search bar */}
      <Paper square elevation={1} sx={{ px: 3, py: 2 }}>
        <Skeleton variant="text" width={240} height={40} />
        <Stack direction="row" spacing={2} sx={{ mt: 1 }}>
          <Skeleton variant="rounded" height={40} sx={{ flex: 1 }} />
          <Skeleton variant="rounded" width={140} height={40} />
          <Skeleton variant="rounded" width={140} height={40} />
          <Skeleton variant="rounded" width={100} height={40} />
        </Stack>
      </Paper>

      {/* Searched postcodes panel and crime overview */}
      <Grid container sx={{ p: 2, pb: 0 }}>
        <Grid size={{ xs: 12, md: 3 }} sx={{ p: 1 }}>
          <Skeleton variant="rounded" height={220} />
        </Grid>
        <Grid size={{ xs: 12, md: 'grow' }} sx={{ p: 1 }}>
          <Skeleton variant="rounded" height={220} />
        </Grid>
      </Grid>

      {/* Map and table */}
      <Grid container sx={{ p: 2 }}>
        <Grid size={{ xs: 12, lg: 6 }} sx={{ p: 1 }}>
          <Skeleton variant="rounded" height={440} />
        </Grid>
        <Grid size={{ xs: 12, lg: 6 }} sx={{ p: 1 }}>
          <Skeleton variant="rounded" height={440} />
        </Grid>
      </Grid>
    </Box>
  );
}
