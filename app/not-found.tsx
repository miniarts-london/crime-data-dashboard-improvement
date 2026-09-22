'use client';

import { Box, Button, Stack, Typography } from '@mui/material';
import Link from 'next/link';

// Shown for any URL that doesn't match a route under the root layout, and
// for anywhere in the app that explicitly calls Next's notFound(). This has
// to be a Client Component, despite having no interactive state of its own:
// MUI's Button is itself a Client Component, and passing next/link's Link
// straight into its `component` prop passes a *function reference*, not a
// rendered element. React Server Components can't serialize a bare function
// across the server->client boundary (only JSX elements, and Server
// Actions explicitly marked with 'use server', are allowed to cross) - so
// with no 'use client' here, prerendering /_not-found fails with "Functions
// cannot be passed directly to Client Components." app/error.tsx never hit
// this because it's already 'use client' itself, so there's no server-to-
// client boundary for that same component={Link} prop to cross.
export default function NotFound() {
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
          Page not found
        </Typography>
        <Typography variant="body1" color="text.secondary">
          There&apos;s nothing here - the dashboard only has one page. Head back to search.
        </Typography>
        <Button component={Link} href="/" variant="contained">
          Back to search
        </Button>
      </Stack>
    </Box>
  );
}
