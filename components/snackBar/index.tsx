import { Alert, IconButton, Snackbar } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import type { ReactNode } from 'react';

interface SnackBarProps {
  openSnackbar: boolean;
  message: string;
  handleCloseSnackbar?: () => void;
  // Optional button shown in the alert, e.g. "Retry".
  action?: ReactNode;
}

export default function SnackBar({ openSnackbar, message, handleCloseSnackbar, action }: SnackBarProps) {
  const onClose = (_event?: unknown, reason?: string) => {
    if (reason === 'clickaway') return;
    handleCloseSnackbar?.();
  };

  return (
    <Snackbar
      anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
      open={openSnackbar && Boolean(message)}
      onClose={onClose}
      autoHideDuration={8000}
    >
      <Alert
        // Alert drops its own close button when `action` is set, so render
        // the extra action and the close button together.
        action={
          <>
            {action}
            <IconButton aria-label="Close" color="inherit" size="small" onClick={() => onClose()}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </>
        }
        severity="error"
        variant="filled"
        sx={{ width: '100%' }}
      >
        {message}
      </Alert>
    </Snackbar>
  );
}
