import { createFileRoute } from '@tanstack/react-router';
import { SampleTraceDemo } from '~/features/traces/SampleTraceDemo';

export const Route = createFileRoute('/sample')({ component: SampleTraceDemo });
