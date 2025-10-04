'use client';

import { title } from '@/components/primitives';
import { useSettingsStore } from '@/store/settingsStore';
import { Card, CardBody, CardHeader } from '@heroui/card';
import { Select, SelectItem } from '@heroui/select';
import { Slider } from '@heroui/slider';
import { Chip } from '@heroui/chip';

export default function SettingsPage() {
  const { filters, setCountry, setTimezone, setAmount } = useSettingsStore();

  const countries = [
    { key: 'all', label: 'All Countries' },
    { key: 'usa', label: 'United States' },
    { key: 'russia', label: 'Russia' },
    { key: 'china', label: 'China' },
    { key: 'europe', label: 'Europe (ESA)' },
    { key: 'japan', label: 'Japan' },
    { key: 'india', label: 'India' },
    { key: 'canada', label: 'Canada' },
    { key: 'brazil', label: 'Brazil' },
    { key: 'australia', label: 'Australia' },
  ];

  const timezones = [
    { key: 'all', label: 'All Timezones' },
    { key: 'utc-12', label: 'UTC-12 (Baker Island)' },
    { key: 'utc-8', label: 'UTC-8 (PST)' },
    { key: 'utc-5', label: 'UTC-5 (EST)' },
    { key: 'utc+0', label: 'UTC+0 (London)' },
    { key: 'utc+1', label: 'UTC+1 (Paris)' },
    { key: 'utc+3', label: 'UTC+3 (Moscow)' },
    { key: 'utc+8', label: 'UTC+8 (Beijing)' },
    { key: 'utc+9', label: 'UTC+9 (Tokyo)' },
    { key: 'utc+10', label: 'UTC+10 (Sydney)' },
  ];

  return (
    <div className="container mx-auto max-w-4xl px-6 py-12">
      <div className="mb-8">
        <h1 className={`${title()} mb-2`}>Settings</h1>
        <p className="text-lg text-gray-500">
          Configure satellite filters and display preferences
        </p>
        <Chip color="success" variant="flat" className="mt-3">
          Settings are saved automatically
        </Chip>
      </div>

      <div className="space-y-6">
        {/* Satellite Filters Card */}
        <Card>
          <CardHeader className="flex flex-col items-start">
            <h2 className="text-2xl font-bold">🛰️ Satellite Filters</h2>
            <p className="text-sm text-gray-500 mt-1">
              Filter which satellites to display on the globe
            </p>
          </CardHeader>
          <CardBody className="space-y-6">
            {/* Country Filter */}
            <div>
              <Select
                label="Filter by Country/Agency"
                placeholder="Select a country or agency"
                selectedKeys={[filters.country]}
                onChange={(e) => setCountry(e.target.value)}
                description="Filter satellites by operating country or space agency"
                classNames={{
                  trigger: "h-12",
                }}
              >
                {countries.map((country) => (
                  <SelectItem key={country.key}>
                    {country.label}
                  </SelectItem>
                ))}
              </Select>
            </div>

            {/* Timezone Filter */}
            <div>
              <Select
                label="Filter by Timezone/Region"
                placeholder="Select a timezone"
                selectedKeys={[filters.timezone]}
                onChange={(e) => setTimezone(e.target.value)}
                description="Show satellites currently visible from selected timezone (Coming Soon)"
                classNames={{
                  trigger: "h-12",
                }}
                isDisabled
              >
                {timezones.map((tz) => (
                  <SelectItem key={tz.key}>
                    {tz.label}
                  </SelectItem>
                ))}
              </Select>
              <p className="text-xs text-warning mt-2">
                ⚠️ Timezone filtering is under development and will be available soon
              </p>
            </div>

            {/* Amount Slider */}
            <div>
              <Slider
                label="Maximum Satellites to Display"
                value={filters.amount}
                onChange={(value: number | number[]) => setAmount(value as number)}
                minValue={10}
                maxValue={500}
                step={10}
                showTooltip={true}
                showSteps={false}
                marks={[
                  { value: 50, label: '50' },
                  { value: 100, label: '100' },
                  { value: 200, label: '200' },
                  { value: 300, label: '300' },
                  { value: 400, label: '400' },
                  { value: 500, label: '500' },
                ]}
                className="max-w-full"
                color="primary"
                size="lg"
              />
              <div className="flex justify-between items-center mt-3">
                <p className="text-sm text-gray-500">
                  Currently displaying up to <strong>{filters.amount}</strong> satellites
                </p>
                <Chip size="sm" color={filters.amount > 300 ? 'warning' : 'success'} variant="flat">
                  {filters.amount > 300 ? 'High Load' : 'Optimal'}
                </Chip>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                💡 Higher values may impact performance on slower devices
              </p>
            </div>
          </CardBody>
        </Card>

        {/* Display Preferences Card */}
        <Card>
          <CardHeader className="flex flex-col items-start">
            <h2 className="text-2xl font-bold">🎨 Display Preferences</h2>
            <p className="text-sm text-gray-500 mt-1">
              Customize visualization appearance
            </p>
          </CardHeader>
          <CardBody>
            <div className="space-y-4">
              <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                <h3 className="font-semibold mb-2">📍 Current Settings Summary</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Country Filter:</span>
                    <span className="font-semibold">
                      {countries.find(c => c.key === filters.country)?.label || 'All Countries'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Timezone Filter:</span>
                    <span className="font-semibold">
                      {timezones.find(tz => tz.key === filters.timezone)?.label || 'All Timezones'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Max Satellites:</span>
                    <span className="font-semibold">{filters.amount}</span>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                <h3 className="font-semibold mb-2">✨ Coming Soon</h3>
                <ul className="space-y-1 text-sm text-gray-500">
                  <li>• Color themes for satellite categories</li>
                  <li>• Orbit visualization styles</li>
                  <li>• Ground station display options</li>
                  <li>• Connection line customization</li>
                  <li>• 3D model quality settings</li>
                </ul>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Info Card */}
        <Card className="bg-gradient-to-r from-green-500/10 to-teal-500/10 border border-green-500/30">
          <CardBody>
            <div className="flex items-start gap-3">
              <span className="text-2xl">💡</span>
              <div>
                <h3 className="font-bold mb-1">About Settings</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  All settings are automatically saved to your browser's local storage and will 
                  persist across sessions. Your preferences are applied immediately to the satellite 
                  view on the main page.
                </p>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
