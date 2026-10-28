"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EyeIcon, EyeSlashIcon, InformationCircleIcon } from "@heroicons/react/16/solid";
import { ServerIcon } from "@heroicons/react/24/outline";
import { Description, InputGroup, Label, Link, ListBox, Select, TextField } from "@heroui-v3/react";
import { useTranslations } from "next-intl";

import type { CalDavCalendarInfo } from "@norish/shared/contracts";

import { useCalDavSettingsContext } from "../context";
import CalDavConfigEditModal from "./caldav-config-edit-modal";
import CalDavConfigSummary from "./caldav-config-summary";

export default function CalDavConfigCard() {
  const t = useTranslations("settings.caldav.setup");
  const { config, saveConfig, testConnection } = useCalDavSettingsContext();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Initial setup form state (only used when no config exists)
  const [serverUrl, setServerUrl] = useState("");
  const [calendarUrl, setCalendarUrl] = useState<string | null>(null);
  const [calendars, setCalendars] = useState<CalDavCalendarInfo[]>([]);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [breakfastTime, setBreakfastTime] = useState("07:00-08:00");
  const [lunchTime, setLunchTime] = useState("12:00-13:00");
  const [dinnerTime, setDinnerTime] = useState("18:00-19:00");
  const [snackTime, setSnackTime] = useState("15:00-16:00");

  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Track if we've already auto-tested to avoid duplicate calls
  const hasAutoTestedRef = useRef(false);

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    setCalendars([]);
    try {
      const result = await testConnection(serverUrl, username, password);

      setTestResult(result);

      // Store returned calendars for selection
      if (result.success && result.calendars && result.calendars.length > 0) {
        setCalendars(result.calendars);
        // Auto-select first calendar
        if (!calendarUrl) {
          const firstCalendar = result.calendars[0];

          if (firstCalendar) {
            setCalendarUrl(firstCalendar.url);
          }
        }
      }
    } finally {
      setTesting(false);
    }
  };

  // Auto-test connection when all credentials are filled
  useEffect(() => {
    // Skip if already testing or if we've already auto-tested
    if (testing || hasAutoTestedRef.current) return;

    if (serverUrl && username && password) {
      hasAutoTestedRef.current = true;
      // Use a local function to avoid dependency issues
      const runAutoTest = async () => {
        setTesting(true);
        setTestResult(null);
        setCalendars([]);
        try {
          const result = await testConnection(serverUrl, username, password);

          setTestResult(result);

          // Store returned calendars for selection
          if (result.success && result.calendars && result.calendars.length > 0) {
            setCalendars(result.calendars);
            // Auto-select first calendar
            if (!calendarUrl) {
              const firstCalendar = result.calendars[0];

              if (firstCalendar) {
                setCalendarUrl(firstCalendar.url);
              }
            }
          }
        } finally {
          setTesting(false);
        }
      };

      runAutoTest();
    }
    // Reset auto-test flag if credentials change after a test
    if (!serverUrl || !username || !password) {
      hasAutoTestedRef.current = false;
    }
  }, [serverUrl, username, password, testing, testConnection, calendarUrl]);

  const handleInitialSetup = async () => {
    setSaving(true);
    setTestResult(null);
    try {
      await saveConfig({
        serverUrl,
        calendarUrl,
        username,
        password,
        enabled: true,
        breakfastTime,
        lunchTime,
        dinnerTime,
        snackTime,
      });
      setPassword(""); // Clear password after save
    } finally {
      setSaving(false);
    }
  };

  // If config exists, show summary
  if (config) {
    return (
      <>
        <CalDavConfigSummary onEditClick={() => setIsEditModalOpen(true)} />
        <CalDavConfigEditModal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} />
      </>
    );
  }

  // If no config, show initial setup form with guidance
  const canSave = serverUrl && username && password && calendarUrl;

  return (
    <Card>
      <Card.Header>
        <div className="flex items-center gap-3">
          <ServerIcon className="text-primary h-6 w-6" />
          <div>
            <h2 className="text-lg font-semibold">{t("title")}</h2>
            <p className="text-default-500 mt-1 text-base">{t("description")}</p>
          </div>
        </div>
      </Card.Header>

      <Card.Content className="gap-4">
        {/* Guidance Section */}
        <div className="bg-primary/10 border-primary/20 rounded-lg border p-4">
          <div className="flex gap-3">
            <InformationCircleIcon className="text-primary mt-0.5 h-5 w-5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-primary mb-2 text-base font-medium">{t("gettingStarted")}</p>
              <p className="text-default-600 mb-2 text-xs">{t("providerDescription")}</p>
              <ul className="text-default-600 ml-4 list-disc space-y-1 text-xs">
                <li>
                  <Link
                    className="text-sm"
                    href="https://docs.nextcloud.com/server/latest/user_manual/en/groupware/calendar.html"
                    rel="noreferrer"
                    target="_blank"
                  >
                    Nextcloud Calendar
                  </Link>
                </li>
                <li>
                  <Link
                    className="text-sm"
                    href="https://radicale.org/"
                    rel="noreferrer"
                    target="_blank"
                  >
                    Radicale
                  </Link>
                </li>
                <li>
                  <Link
                    className="text-sm"
                    href="https://support.apple.com/guide/calendar/set-up-accounts-icl4308d6701/mac"
                    rel="noreferrer"
                    target="_blank"
                  >
                    Apple Calendar
                  </Link>
                </li>
                <li>
                  <Link
                    className="text-sm"
                    href="https://support.google.com/calendar/answer/99358"
                    rel="noreferrer"
                    target="_blank"
                  >
                    Google Calendar
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Setup Form */}
        <TextField fullWidth isRequired value={serverUrl} onChange={setServerUrl}>
          <Label>{t("serverUrlLabel")}</Label>
          <InputGroup fullWidth variant="secondary">
            <InputGroup.Input placeholder={t("serverUrlPlaceholder")} />
          </InputGroup>
          <Description>{t("serverUrlDescription")}</Description>
        </TextField>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <TextField fullWidth isRequired value={username} onChange={setUsername}>
            <Label>{t("usernameLabel")}</Label>
            <InputGroup fullWidth variant="secondary">
              <InputGroup.Input placeholder={t("usernamePlaceholder")} />
            </InputGroup>
          </TextField>
          <TextField fullWidth isRequired value={password} onChange={setPassword}>
            <Label>{t("passwordLabel")}</Label>
            <InputGroup fullWidth variant="secondary">
              <InputGroup.Input
                placeholder={t("passwordPlaceholder")}
                type={showPassword ? "text" : "password"}
              />
              <InputGroup.Suffix>
                <Button
                  isIconOnly
                  aria-label={`${showPassword ? "Hide" : "Show"} ${t("passwordLabel")}`}
                  size="sm"
                  variant="ghost"
                  onPress={() => setShowPassword((current) => !current)}
                >
                  {showPassword ? (
                    <EyeSlashIcon className="text-default-400 h-4 w-4" />
                  ) : (
                    <EyeIcon className="text-default-400 h-4 w-4" />
                  )}
                </Button>
              </InputGroup.Suffix>
            </InputGroup>
          </TextField>
        </div>

        {/* Calendar Selection - always visible, disabled until calendars fetched */}
        <Select
          fullWidth
          isDisabled={calendars.length === 0}
          placeholder={
            calendars.length === 0 ? t("calendarPlaceholderDisabled") : t("calendarPlaceholder")
          }
          selectedKey={calendarUrl}
          variant="secondary"
          onSelectionChange={(selected) => {
            setCalendarUrl(typeof selected === "string" ? selected : null);
          }}
        >
          <Label>{t("calendarLabel")}</Label>
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox aria-label={t("calendarLabel")}>
              {calendars.map((cal) => (
                <ListBox.Item key={cal.url} id={cal.url} textValue={cal.displayName}>
                  {cal.displayName}
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
          <Description>
            {calendars.length === 0 ? t("calendarDescriptionDisabled") : t("calendarDescription")}
          </Description>
        </Select>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField fullWidth value={breakfastTime} onChange={setBreakfastTime}>
            <Label>{t("breakfastTime")}</Label>
            <InputGroup fullWidth variant="secondary">
              <InputGroup.Input placeholder="07:00-08:00" />
            </InputGroup>
            <Description>{t("timeFormat")}</Description>
          </TextField>
          <TextField fullWidth value={lunchTime} onChange={setLunchTime}>
            <Label>{t("lunchTime")}</Label>
            <InputGroup fullWidth variant="secondary">
              <InputGroup.Input placeholder="12:00-13:00" />
            </InputGroup>
            <Description>{t("timeFormat")}</Description>
          </TextField>
          <TextField fullWidth value={dinnerTime} onChange={setDinnerTime}>
            <Label>{t("dinnerTime")}</Label>
            <InputGroup fullWidth variant="secondary">
              <InputGroup.Input placeholder="18:00-19:00" />
            </InputGroup>
            <Description>{t("timeFormat")}</Description>
          </TextField>
          <TextField fullWidth value={snackTime} onChange={setSnackTime}>
            <Label>{t("snackTime")}</Label>
            <InputGroup fullWidth variant="secondary">
              <InputGroup.Input placeholder="15:00-16:00" />
            </InputGroup>
            <Description>{t("timeFormat")}</Description>
          </TextField>
        </div>

        {testResult && (
          <div
            className={`rounded-lg p-3 text-base ${
              testResult.success ? "bg-success/10 text-success" : "bg-danger/10 text-danger"
            }`}
          >
            {testResult.message}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button
            isDisabled={!canSave}
            isPending={testing}
            variant="outline"
            onPress={handleTestConnection}
          >
            {t("testConnection")}
          </Button>
          <Button
            isDisabled={!canSave}
            isPending={saving}
            variant="primary"
            onPress={handleInitialSetup}
          >
            {t("saveConfiguration")}
          </Button>
        </div>
      </Card.Content>
    </Card>
  );
}
