import { createFileRoute } from '@tanstack/react-router';
import { LabPage } from '~/features/runtime-lab/LabPage';

export const Route = createFileRoute('/lab')({ component: LabPage });
