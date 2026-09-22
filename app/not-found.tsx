import { Box, Button, Stack, Typography } from '@mui/material';
import Link from 'next/link';

// Shown for any URL that doesn't match a route under the root layout, and
// for anywhere in the app that explicitly calls Next's notFound(). A plain
// Server Component - no client state involved, so it doesn't need 'use
// client' the way app/error.tsx does.
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
