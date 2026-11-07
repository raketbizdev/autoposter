import React from 'react';
import { Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Paper, Stack, Typography } from '@mui/material';
import { Ban, CircleCheck, CircleX, Clock, Flag, Hourglass, Loader, Play, Square, TriangleAlert, UserRound, UserRoundPlus, UsersRound } from 'lucide-react';
import { STATUS_COLOR, TYPE_COLOR } from './theme.js';
import { api, STATUS_LABEL, TYPE_LABEL } from './api.js';

const STATUS_ICON = {
  queued: Clock, running: Loader, submitted: CircleCheck, pending_approval: Hourglass,
  awaiting_join: UserRoundPlus, failed: CircleX, needs_check: TriangleAlert, cancelled: Ban,
};
const TYPE_ICON = { profile: UserRound, page: Flag, group: UsersRound };

export function StatusChip({ status }) {
  const Icon = STATUS_ICON[status];
  const c = STATUS_COLOR[status];
  return (
    <Chip size="small" label={STATUS_LABEL[status]}
      icon={<Icon size={14} className={status === 'running' ? 'spin' : undefined} />}
      sx={{ color: c.fg, bgcolor: c.bg, '& .MuiChip-icon': { color: c.fg } }} />
  );
}

export function TypeBadge({ type, withLabel = true }) {
  const Icon = TYPE_ICON[type];
  const color = TYPE_COLOR[type];
  return (
    <Stack direction="row" alignItems="center" spacing={0.75} sx={{ color, flex: 'none' }}>
      <Box sx={{ width: 26, height: 26, borderRadius: '8px', display: 'grid', placeItems: 'center', bgcolor: `${color}17` }}>
        <Icon size={15} />
      </Box>
      {withLabel && <Typography variant="caption" fontWeight={700}>{TYPE_LABEL[type]}</Typography>}
    </Stack>
  );
}

export function Panel({ title, action, children, sx }) {
  return (
    <Paper sx={{ p: { xs: 2, md: 2.5 }, ...sx }}>
      {(title || action) && (
        <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2} spacing={2}>
          {title && <Typography variant="h2">{title}</Typography>}
          {action}
        </Stack>
      )}
      {children}
    </Paper>
  );
}

export function EmptyState({ icon: Icon, title, children }) {
  return (
    <Stack alignItems="center" spacing={1.25} sx={{ py: 5, textAlign: 'center', color: 'text.secondary' }}>
      <Box sx={{ width: 48, height: 48, borderRadius: '14px', display: 'grid', placeItems: 'center', bgcolor: 'background.default' }}>
        <Icon size={22} />
      </Box>
      <Typography fontWeight={700} color="text.primary">{title}</Typography>
      {children}
    </Stack>
  );
}

/**
 * Start/stop button for the background worker. Starting asks first when posts are already overdue,
 * because they go out as soon as the worker runs.
 */
export function WorkerControl({ status, onChange, variant = 'contained', size = 'medium', sx }) {
  const [confirm, setConfirm] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  if (!status) return null;

  async function run(action) {
    setBusy(true);
    setError('');
    try { await action(); setConfirm(false); onChange?.(); } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  const start = () => run(api.startWorker);
  const stop = () => run(api.stopWorker);

  if (status.worker_running) {
    if (status.worker_launchd) return null; // launchd restarts it; stopping is done with the uninstall script
    return (
      <>
        <Button size={size} variant="outlined" color="inherit" disabled={busy} onClick={stop} startIcon={<Square size={14} />} sx={sx}>
          {busy ? 'Stopping…' : 'Stop worker'}
        </Button>
        {error && <Typography variant="caption" color="error" display="block" mt={0.5}>{error}</Typography>}
      </>
    );
  }

  return (
    <>
      <Button size={size} variant={variant} disabled={busy} startIcon={<Play size={15} />} sx={sx}
        onClick={() => (status.overdue ? setConfirm(true) : start())}>
        {busy ? 'Starting…' : 'Start worker'}
      </Button>
      {error && !confirm && <Typography variant="caption" color="error" display="block" mt={0.5}>{error}</Typography>}
      <Dialog open={confirm} onClose={() => !busy && setConfirm(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontFamily: '"Bricolage Grotesque Variable"', fontWeight: 700 }}>
          {status.overdue} overdue post{status.overdue === 1 ? '' : 's'} will go out now
        </DialogTitle>
        <DialogContent>
          <Typography color="text.secondary">
            These were scheduled while the worker was stopped. Once it starts they publish one after another,
            a few minutes each. Cancel any you don't want in the Queue first.
          </Typography>
          {error && <Typography color="error" mt={1.5}>{error}</Typography>}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button color="secondary" disabled={busy} onClick={() => setConfirm(false)}>Not yet</Button>
          <Button variant="contained" disabled={busy} onClick={start}>{busy ? 'Starting…' : 'Start and post'}</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
