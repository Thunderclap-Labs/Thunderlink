'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardBody, CardHeader } from '@heroui/card';
import { Select, SelectItem } from '@heroui/select';
import { Chip } from '@heroui/chip';
import { Progress } from '@heroui/progress';
import { Tooltip } from '@heroui/tooltip';
import {
  calculateDownlinkDataRate,
  getCurrentSolarActivity,
  getCurrentWeather,
  getOptimalFrequencyBand,
  formatDataRate,
  getRiskLevelColor,
  getCertaintyDescription,
  getWeatherEmoji,
  getWeatherDisplayName,
  getSolarActivityEmoji,
  getSolarActivityDisplayName,
  getSolarActivityColor,
  FrequencyBand,
  DownlinkPrediction,
} from '@/utils/downlinkCalculations';

interface DownlinkPredictionCardProps {
  elevationAngle: number;
  groundStationLat: number;
  groundStationLon: number;
  onFrequencyChange?: (band: FrequencyBand) => void;
}

export default function DownlinkPredictionCard({
  elevationAngle,
  groundStationLat,
  groundStationLon,
  onFrequencyChange,
}: DownlinkPredictionCardProps) {
  const [selectedBand, setSelectedBand] = useState<FrequencyBand>('Ka-band');
  const [prediction, setPrediction] = useState<DownlinkPrediction | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const frequencyBands: FrequencyBand[] = ['Ka-band', 'Ku-band', 'X-band', 'C-band', 'S-band', 'L-band'];

  // Calculate prediction
  useEffect(() => {
    const updatePrediction = () => {
      const solarActivity = getCurrentSolarActivity();
      const weather = getCurrentWeather(groundStationLat, groundStationLon);

      const newPrediction = calculateDownlinkDataRate(
        selectedBand,
        elevationAngle,
        solarActivity,
        weather,
        groundStationLat,
        groundStationLon
      );

      setPrediction(newPrediction);
    };

    updatePrediction();

    // Auto-refresh every 30 seconds if enabled
    if (autoRefresh) {
      const interval = setInterval(updatePrediction, 30000);
      return () => clearInterval(interval);
    }
  }, [selectedBand, elevationAngle, groundStationLat, groundStationLon, autoRefresh]);

  // Get optimal frequency band recommendation
  const getOptimalBand = () => {
    if (!prediction) return null;
    const solarActivity = getCurrentSolarActivity();
    const weather = getCurrentWeather(groundStationLat, groundStationLon);
    return getOptimalFrequencyBand(elevationAngle, solarActivity, weather, groundStationLat, groundStationLon);
  };

  const optimalBand = getOptimalBand();

  if (!prediction) {
    return (
      <Card>
        <CardBody>
          <div className="flex items-center justify-center py-4">
            <div className="animate-pulse">Loading downlink prediction...</div>
          </div>
        </CardBody>
      </Card>
    );
  }

  const degradationPercentage = (prediction.adjustedDataRate / prediction.baseDataRate) * 100;

  return (
    <div className="space-y-4">
      {/* Main Prediction Card */}
      <Card className="border-2 border-primary">
        <CardHeader className="flex flex-col gap-2">
          <div className="flex items-center justify-between w-full">
            <h3 className="text-lg font-bold">📡 Downlink Data Rate Prediction</h3>
            <Chip color={getRiskLevelColor(prediction.riskLevel) as any} size="sm" variant="flat">
              {prediction.riskLevel.toUpperCase()}
            </Chip>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span className={autoRefresh ? 'text-green-500' : ''}>
              {autoRefresh ? '🔄 Auto-refresh: 30s' : '⏸️ Paused'}
            </span>
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className="text-primary hover:underline"
            >
              {autoRefresh ? 'Pause' : 'Resume'}
            </button>
          </div>
        </CardHeader>
        <CardBody className="space-y-4">
          {/* Frequency Band Selection */}
          <div className="space-y-2">
            <Select
              label="Frequency Band"
              selectedKeys={[selectedBand]}
              onChange={(e) => {
                const band = e.target.value as FrequencyBand;
                setSelectedBand(band);
                onFrequencyChange?.(band);
              }}
              description="Select the operating frequency band"
            >
              {frequencyBands.map((band) => (
                <SelectItem key={band}>
                  {band}
                  {optimalBand?.band === band && ' ⭐ Optimal'}
                </SelectItem>
              ))}
            </Select>
            {optimalBand && optimalBand.band !== selectedBand && (
              <div className="text-xs text-warning">
                💡 Tip: {optimalBand.band} might provide better performance under current conditions
              </div>
            )}
          </div>

          {/* Data Rate Display */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
              <div className="text-xs text-gray-500 mb-1">Base Data Rate</div>
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {formatDataRate(prediction.baseDataRate)}
              </div>
              <div className="text-xs text-gray-500">Ideal conditions</div>
            </div>
            <div className="p-4 bg-purple-50 dark:bg-purple-950 rounded-lg">
              <div className="text-xs text-gray-500 mb-1">Predicted Data Rate</div>
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {formatDataRate(prediction.adjustedDataRate)}
              </div>
              <div className="text-xs text-gray-500">With environmental factors</div>
            </div>
          </div>

          {/* Signal Quality Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">Signal Quality</span>
              <span className="text-sm text-gray-500">{degradationPercentage.toFixed(1)}%</span>
            </div>
            <Progress
              value={degradationPercentage}
              color={degradationPercentage > 75 ? 'success' : degradationPercentage > 50 ? 'warning' : 'danger'}
              className="w-full"
            />
          </div>

          {/* Certainty Factor */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">Certainty Factor</span>
              <Tooltip content="How confident we are in this prediction">
                <span className="text-sm text-gray-500">
                  {getCertaintyDescription(prediction.certaintyFactor)} ({(prediction.certaintyFactor * 100).toFixed(0)}%)
                </span>
              </Tooltip>
            </div>
            <Progress
              value={prediction.certaintyFactor * 100}
              color={prediction.certaintyFactor > 0.7 ? 'success' : prediction.certaintyFactor > 0.4 ? 'warning' : 'danger'}
              className="w-full"
            />
          </div>
        </CardBody>
      </Card>

      {/* Environmental Factors */}
      <Card>
        <CardHeader className="font-semibold">🌍 Environmental Factors</CardHeader>
        <CardBody className="space-y-4">
          {/* Weather Conditions */}
          <div className="p-3 bg-gradient-to-r from-blue-500/10 to-cyan-500/10 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{getWeatherEmoji(prediction.weatherData.condition)}</span>
                <div>
                  <div className="font-semibold">{getWeatherDisplayName(prediction.weatherData.condition)}</div>
                  <div className="text-xs text-gray-500">Weather Impact: {(prediction.degradationFactors.weather * 100).toFixed(0)}%</div>
                </div>
              </div>
              <Chip size="sm" color={prediction.degradationFactors.weather > 0.7 ? 'success' : prediction.degradationFactors.weather > 0.5 ? 'warning' : 'danger'}>
                {prediction.degradationFactors.weather > 0.8 ? 'Excellent' : prediction.degradationFactors.weather > 0.6 ? 'Good' : prediction.degradationFactors.weather > 0.4 ? 'Fair' : 'Poor'}
              </Chip>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-gray-500">Cloud Coverage:</span>
                <span className="font-semibold ml-1">{prediction.weatherData.cloudCoverage.toFixed(0)}%</span>
              </div>
              <div>
                <span className="text-gray-500">Precipitation:</span>
                <span className="font-semibold ml-1">{prediction.weatherData.precipitationRate.toFixed(1)} mm/hr</span>
              </div>
              <div>
                <span className="text-gray-500">Temperature:</span>
                <span className="font-semibold ml-1">{prediction.weatherData.temperature.toFixed(1)}°C</span>
              </div>
              <div>
                <span className="text-gray-500">Humidity:</span>
                <span className="font-semibold ml-1">{prediction.weatherData.humidity.toFixed(0)}%</span>
              </div>
              <div>
                <span className="text-gray-500">Visibility:</span>
                <span className="font-semibold ml-1">{prediction.weatherData.visibility.toFixed(1)} km</span>
              </div>
              <div>
                <span className="text-gray-500">Wind Speed:</span>
                <span className="font-semibold ml-1">{prediction.weatherData.windSpeed.toFixed(0)} km/h</span>
              </div>
            </div>
          </div>

          {/* Solar Activity */}
          <div className="p-3 bg-gradient-to-r from-yellow-500/10 to-orange-500/10 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{getSolarActivityEmoji(prediction.solarData.level)}</span>
                <div>
                  <div className="font-semibold">{getSolarActivityDisplayName(prediction.solarData.level)}</div>
                  <div className="text-xs text-gray-500">Solar Impact: {(prediction.degradationFactors.solar * 100).toFixed(0)}%</div>
                </div>
              </div>
              <Chip size="sm" color={getSolarActivityColor(prediction.solarData.level) as any}>
                {prediction.solarData.level}
              </Chip>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-gray-500">Solar Flux:</span>
                <span className="font-semibold ml-1">{prediction.solarData.solarFluxIndex.toFixed(0)} SFU</span>
              </div>
              <div>
                <span className="text-gray-500">Kp Index:</span>
                <span className="font-semibold ml-1">{prediction.solarData.geomagneticIndex.toFixed(1)}</span>
              </div>
              <div>
                <span className="text-gray-500">Solar Wind:</span>
                <span className="font-semibold ml-1">{prediction.solarData.solarWindSpeed.toFixed(0)} km/s</span>
              </div>
              <div>
                <span className="text-gray-500">X-Ray Flux:</span>
                <span className="font-semibold ml-1">{prediction.solarData.xRayFlux}</span>
              </div>
            </div>
          </div>

          {/* Other Factors */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-lg">
              <div className="text-xs text-gray-500 mb-1">Elevation Angle</div>
              <div className="text-xl font-bold">{elevationAngle.toFixed(1)}°</div>
              <div className="text-xs text-gray-500">Impact: {(prediction.degradationFactors.elevation * 100).toFixed(0)}%</div>
            </div>
            <div className="p-3 bg-gradient-to-r from-green-500/10 to-teal-500/10 rounded-lg">
              <div className="text-xs text-gray-500 mb-1">Atmospheric</div>
              <div className="text-xl font-bold">{(prediction.degradationFactors.atmospheric * 100).toFixed(0)}%</div>
              <div className="text-xs text-gray-500">Path attenuation</div>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Recommendations */}
      {prediction.recommendations.length > 0 && (
        <Card className="border border-primary/30">
          <CardHeader className="font-semibold">💡 Recommendations</CardHeader>
          <CardBody>
            <ul className="space-y-2">
              {prediction.recommendations.map((rec, index) => (
                <li key={index} className="text-sm flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}

      {/* Technical Summary */}
      <Card className="bg-gradient-to-r from-gray-500/5 to-gray-600/5">
        <CardHeader className="font-semibold text-sm">📊 Technical Summary</CardHeader>
        <CardBody>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-500">Frequency Band:</span>
              <span className="font-semibold">{selectedBand}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Base Capacity:</span>
              <span className="font-semibold">{formatDataRate(prediction.baseDataRate)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Expected Throughput:</span>
              <span className="font-semibold">{formatDataRate(prediction.adjustedDataRate)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Signal Efficiency:</span>
              <span className="font-semibold">{degradationPercentage.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Prediction Confidence:</span>
              <span className="font-semibold">{getCertaintyDescription(prediction.certaintyFactor)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Risk Assessment:</span>
              <Chip size="sm" color={getRiskLevelColor(prediction.riskLevel) as any} variant="flat">
                {prediction.riskLevel}
              </Chip>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
