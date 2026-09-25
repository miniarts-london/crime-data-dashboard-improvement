'use client';

import { useEffect } from 'react';
import { catchError, type ErrorInfo } from 'next/error';
import { Box, Button, Stack, Typography } from '@mui/material';

// Component-level boundary around the Leaflet map only. Leaflet and the
// marker-cluster plugin touch the DOM directly, and a bad coordinate or a
// failed map-chunk load would otherwise bubble up to app/error.tsx and
// replace the whole dashboard - taking the table and overview (which still
// have perfectly good data) down with it. Here the map fails alone.
function CrimeMapFallback(_props: object, { error, reset }: ErrorInfo) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Box
      role="alert"
      sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', px: 2 }}
    >
      <Stack spacing={1.5} sx={{ alignItems: 'center', textAlign: 'center', maxWidth: 360 }}>
        <Typography variant="subtitle1">The map couldn&apos;t be displayed</Typography>
        <Typography variant="body2" color="text.secondary">
          The crime table and breakdown still show your results.
        </Typography>
        {/* reset(), not retry(): the map is purely client-rendered, so a
            re-render is all that's needed - retry() would re-fetch the page. */}
        <Button size="small" variant="outlined" onClick={() => reset()}>
          Try again
        </Button>
      </Stack>
    </Box>
  );
}

export default catchError(CrimeMapFallback);
