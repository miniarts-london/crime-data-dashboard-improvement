'use client';

import { useEffect } from 'react';
import { Box, Button, Stack, Typography } from '@mui/material';
import Link from 'next/link';

// App Router error boundary for everything under the root layout (the
// dashboard page, any future routes). It does NOT replace layout.tsx, so
// Providers - and therefore the MUI theme/CssBaseline - is still mounted
// around this: a search gone wrong (a thrown error anywhere in Dashboard's
// render, not just a caught rejection) lands here instead of a blank page
// or Next's generic default error screen.
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // A real deployment would send this to an error-reporting service
    // (Sentry, etc.) here. Logging it is the minimum so the failure is
    // still visible somewhere instead of just showing a friendly message
    // and losing the actual cause.
    console.error(error);
  }, [error]);

  return (
    <Box
      sx={{
        minHeight: '60vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        px: 2,
      }}
    >
      <Stack spacing={2} sx={{ alignItems: 'center', textAlign: 'center', maxWidth: 480 }}>
        <Typography variant="overline" color="text.secondary">
          UK Police data
        </Typography>
        <Typography variant="h4" component="h1">
          Something went wrong
        </Typography>
        <Typography variant="body1" color="text.secondary">
          The dashboard hit an unexpected error while loading. Try again, or head back to search.
        </Typography>
        <Stack direction="row" spacing={2}>
          <Button variant="contained" onClick={() => reset()}>
            Try again
          </Button>
          <Button component={Link} href="/" variant="outlined">
            Back to search
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}
