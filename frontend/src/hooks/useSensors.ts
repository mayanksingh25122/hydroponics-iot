import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { getDeviceStatus, getLatestSensor, getSensorHistory } from "@/services/sensorService";
import type { DeviceStatus, SensorReading, SensorHistory } from "@/types/sensor";

const POLL_INTERVAL_MS = 5000;

interface UseSensorsResult {
  data: SensorReading | undefined;
  loading: boolean;
  error: Error | null;
  refetch: UseQueryResult<SensorReading, Error>["refetch"];
}

export function useLatestSensor(): UseSensorsResult {
  const { data, isLoading, error, refetch } = useQuery<SensorReading, Error>({
    queryKey: ["sensors", "latest"],
    queryFn: getLatestSensor,
    refetchInterval: POLL_INTERVAL_MS,
    refetchIntervalInBackground: true,
    staleTime: 0,
  });

  return {
    data,
    loading: isLoading,
    error: error ?? null,
    refetch,
  };
}

interface UseSensorHistoryResult {
  data: SensorHistory | undefined;
  loading: boolean;
  error: Error | null;
  refetch: UseQueryResult<SensorHistory, Error>["refetch"];
}

export function useSensorHistory(): UseSensorHistoryResult {
  const { data, isLoading, error, refetch } = useQuery<SensorHistory, Error>({
    queryKey: ["sensors", "history"],
    queryFn: getSensorHistory,
    refetchInterval: POLL_INTERVAL_MS,
    refetchIntervalInBackground: true,
    staleTime: 0,
  });

  return {
    data,
    loading: isLoading,
    error: error ?? null,
    refetch,
  };
}

interface UseDeviceStatusResult {
  data: DeviceStatus | undefined;
  loading: boolean;
  error: Error | null;
  refetch: UseQueryResult<DeviceStatus, Error>["refetch"];
}

export function useDeviceStatus(deviceId: number): UseDeviceStatusResult {
  const { data, isLoading, error, refetch } = useQuery<DeviceStatus, Error>({
    queryKey: ["devices", deviceId, "status"],
    queryFn: () => getDeviceStatus(deviceId),
    refetchInterval: POLL_INTERVAL_MS,
    refetchIntervalInBackground: true,
    staleTime: 0,
  });

  return {
    data,
    loading: isLoading,
    error: error ?? null,
    refetch,
  };
}
