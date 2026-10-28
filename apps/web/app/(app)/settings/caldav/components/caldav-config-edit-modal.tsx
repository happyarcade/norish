"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import SecretInput from "@/components/shared/secret-input";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { ServerIcon } from "@heroicons/react/24/outline";
import {
  Accordion,
  Description,
  FieldError,
  InputGroup,
  Label,
  ListBox,
  Modal,
  Select,
  TextField,
  useOverlayState,
} from "@heroui-v3/react";
import { useTranslations } from "next-intl";

import type { CalDavCalendarInfo } from "@norish/shared/contracts";

import { useCalDavSettingsContext } from "../context";

interface CalDavConfigEditModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CalDavConfigEditModal({ isOpen, onClose }: CalDavConfigEditModalProps) {
  const t = useTranslations("settings.caldav.setup");
  const tConfig = useTranslations("settings.caldav.config");
  const { config, saveConfig, testConnection, getCaldavPassword } = useCalDavSettingsContext();
  const modalState = useOverlayState({
    isOpen,
    onOpenChange: (open) => {
      if (!open) onClose();
    },
  });

  const [serverUrl, setServerUrl] = useState("");
  const [calendarUrl, setCalendarUrl] = useState<string | null>(null);
  const [calendars, setCalendars] = useState<CalDavCalendarInfo[]>([]);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [breakfastTime, setBreakfastTime] = useState("07:00-08:00");
  const [lunchTime, setLunchTime] = useState("12:00-13:00");
  const [dinnerTime, setDinnerTime] = useState("18:00-19:00");
  const [snackTime, setSnackTime] = useState("15:00-16:00");

  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const [timeErrors, setTimeErrors] = useState<{
    breakfast?: string;
    lunch?: string;
    dinner?: string;
    snack?: string;
  }>({});

  // Track if we've already auto-tested to avoid duplicate calls
  const hasAutoTestedRef = useRef(false);

  // Get user's timezone
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  // Time format regex
  const timeRegex = /^\d{2}:\d{2}-\d{2}:\d{2}$/;

  // Load existing config
  useEffect(() => {
    if (config && isOpen) {
      setServerUrl(config.serverUrl);
      setCalendarUrl(config.calendarUrl ?? null);
      setUsername(config.username);
      setPassword("");
      setEnabled(config.enabled);
      setBreakfastTime(config.breakfastTime);
      setLunchTime(config.lunchTime);
      setDinnerTime(config.dinnerTime);
      setSnackTime(config.snackTime);
      setTestResult(null);
      setCalendars([]);
      hasAutoTestedRef.current = false;
    }
  }, [config, isOpen]);

  const performTestConnection = useCallback(
    async (url: string, user: string, pass: string, currentCalendarUrl: string | null = null) => {
      setTesting(true);
      setTestResult(null);
      setCalendars([]);
      try {
        const result = await testConnection(url, user, pass);

        setTestResult(result);

        // Store returned calendars for selection
        if (result.success && result.calendars && result.calendars.length > 0) {
          setCalendars(result.calendars);
          // Auto-select first calendar if none selected, or keep existing selection if valid
          if (!currentCalendarUrl || !result.calendars.some((c) => c.url === currentCalendarUrl)) {
            const firstCalendar = result.calendars[0];

            if (firstCalendar) {
              setCalendarUrl(firstCalendar.url);
            }
          }
        }
      } finally {
        setTesting(false);
      }
    },
    [testConnection]
  );

  const handleRevealPassword = useCallback(async () => {
    const revealedPassword = await getCaldavPassword();

    // Auto-test after revealing password
    if (revealedPassword && serverUrl && username && !testing && !hasAutoTestedRef.current) {
      hasAutoTestedRef.current = true;
      // Small delay to allow state to update
      setTimeout(() => {
        performTestConnection(serverUrl, username, revealedPassword, calendarUrl);
      }, 100);
    }

    return revealedPassword;
  }, [getCaldavPassword, serverUrl, username, testing, calendarUrl, performTestConnection]);

  const validateTimeFormat = (time: string, field: string) => {
    if (!timeRegex.test(time)) {
      setTimeErrors((prev) => ({
        ...prev,
        [field]: "Format must be HH:MM-HH:MM",
      }));

      return false;
    }
    setTimeErrors((prev) => {
      const newErrors = { ...prev };

      delete newErrors[field as keyof typeof timeErrors];

      return newErrors;
    });

    return true;
  };

  const handleTestConnection = async () => {
    // Use form values for test
    const passwordToUse = password || (config ? await getCaldavPassword() : null) || "";

    await performTestConnection(serverUrl, username, passwordToUse, calendarUrl);
  };

  // Auto-test connection when password is entered (for new password)
  useEffect(() => {
    if (serverUrl && username && password && !testing && !hasAutoTestedRef.current && isOpen) {
      hasAutoTestedRef.current = true;
      performTestConnection(serverUrl, username, password, calendarUrl);
    }
  }, [password, serverUrl, username, testing, isOpen, performTestConnection, calendarUrl]);

  const handleSave = async () => {
    // Validate time formats
    const breakfastValid = validateTimeFormat(breakfastTime, "breakfast");
    const lunchValid = validateTimeFormat(lunchTime, "lunch");
    const dinnerValid = validateTimeFormat(dinnerTime, "dinner");
    const snackValid = validateTimeFormat(snackTime, "snack");

    if (!breakfastValid || !lunchValid || !dinnerValid || !snackValid) {
      return;
    }

    setSaving(true);
    setTestResult(null);
    try {
      await saveConfig({
        serverUrl,
        calendarUrl,
        username,
        password, // Empty string if not changed
        enabled,
        breakfastTime,
        lunchTime,
        dinnerTime,
        snackTime,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const canSave = serverUrl && username && (password || config) && calendarUrl;

  return (
    <Modal state={modalState}>
      <Modal.Backdrop className="z-[1099]" variant="blur">
        <Modal.Container className="z-[1100] max-w-2xl" placement="center" size="lg">
          <Modal.Dialog className="max-h-[90vh]">
            <Modal.CloseTrigger aria-label="Close" />
            <Modal.Header>
              <Modal.Heading className="flex items-center gap-2">
                <ServerIcon className="h-5 w-5" />
                {tConfig("editTitle")}
              </Modal.Heading>
            </Modal.Header>
            <Modal.Body className="overflow-y-auto">
              <div className="flex flex-col gap-4">
                <TextField fullWidth isRequired value={serverUrl} onChange={setServerUrl}>
                  <Label>{t("serverUrlLabel")}</Label>
                  <InputGroup fullWidth variant="secondary">
                    <InputGroup.Input placeholder={t("serverUrlPlaceholder")} />
                  </InputGroup>
                  <Description>{t("serverUrlDescription")}</Description>
                </TextField>

                <TextField fullWidth isRequired value={username} onChange={setUsername}>
                  <Label>{t("usernameLabel")}</Label>
                  <InputGroup fullWidth variant="secondary">
                    <InputGroup.Input placeholder={t("usernamePlaceholder")} />
                  </InputGroup>
                </TextField>

                {/* Password Section */}
                <SecretInput
                  isRequired
                  isConfigured={!!config}
                  label={t("passwordLabel")}
                  placeholder={t("passwordPlaceholder")}
                  value={password}
                  onReveal={handleRevealPassword}
                  onValueChange={setPassword}
                />

                {/* Test Connection Result */}
                {testResult && (
                  <Chip color={testResult.success ? "success" : "danger"} size="sm" variant="soft">
                    <Chip.Label>{testResult.message}</Chip.Label>
                  </Chip>
                )}

                {/* Calendar Selection - always visible, disabled until calendars fetched */}
                <Select
                  fullWidth
                  isDisabled={calendars.length === 0}
                  placeholder={
                    calendars.length === 0
                      ? t("calendarPlaceholderDisabled")
                      : t("calendarPlaceholder")
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
                    {calendars.length === 0
                      ? t("calendarDescriptionDisabled")
                      : t("calendarDescription")}
                  </Description>
                </Select>

                {/* Advanced Settings */}
                <Accordion>
                  <Accordion.Item id="advanced">
                    <Accordion.Heading>
                      <Accordion.Trigger>
                        {tConfig("advancedSettings")}
                        <Accordion.Indicator />
                      </Accordion.Trigger>
                    </Accordion.Heading>
                    <Accordion.Panel>
                      <Accordion.Body className="flex flex-col gap-4 pb-4">
                        <p className="text-default-500 text-xs">
                          {tConfig("timezone", { timezone })}
                        </p>

                        <TextField
                          fullWidth
                          isInvalid={!!timeErrors.breakfast}
                          value={breakfastTime}
                          onChange={(value) => {
                            setBreakfastTime(value);
                            validateTimeFormat(value, "breakfast");
                          }}
                        >
                          <Label>{t("breakfastTime")}</Label>
                          <InputGroup fullWidth variant="secondary">
                            <InputGroup.Input placeholder="07:00-08:00" />
                          </InputGroup>
                          <Description>{t("timeFormat")}</Description>
                          <FieldError>{t("timeFormatError")}</FieldError>
                        </TextField>

                        <TextField
                          fullWidth
                          isInvalid={!!timeErrors.lunch}
                          value={lunchTime}
                          onChange={(value) => {
                            setLunchTime(value);
                            validateTimeFormat(value, "lunch");
                          }}
                        >
                          <Label>{t("lunchTime")}</Label>
                          <InputGroup fullWidth variant="secondary">
                            <InputGroup.Input placeholder="12:00-13:00" />
                          </InputGroup>
                          <Description>{t("timeFormat")}</Description>
                          <FieldError>{t("timeFormatError")}</FieldError>
                        </TextField>

                        <TextField
                          fullWidth
                          isInvalid={!!timeErrors.dinner}
                          value={dinnerTime}
                          onChange={(value) => {
                            setDinnerTime(value);
                            validateTimeFormat(value, "dinner");
                          }}
                        >
                          <Label>{t("dinnerTime")}</Label>
                          <InputGroup fullWidth variant="secondary">
                            <InputGroup.Input placeholder="18:00-19:00" />
                          </InputGroup>
                          <Description>{t("timeFormat")}</Description>
                          <FieldError>{t("timeFormatError")}</FieldError>
                        </TextField>

                        <TextField
                          fullWidth
                          isInvalid={!!timeErrors.snack}
                          value={snackTime}
                          onChange={(value) => {
                            setSnackTime(value);
                            validateTimeFormat(value, "snack");
                          }}
                        >
                          <Label>{t("snackTime")}</Label>
                          <InputGroup fullWidth variant="secondary">
                            <InputGroup.Input placeholder="15:00-16:00" />
                          </InputGroup>
                          <Description>{t("timeFormat")}</Description>
                          <FieldError>{t("timeFormatError")}</FieldError>
                        </TextField>
                      </Accordion.Body>
                    </Accordion.Panel>
                  </Accordion.Item>
                </Accordion>
              </div>
            </Modal.Body>
            <Modal.Footer>
              <Button
                isDisabled={!serverUrl || !username || (!password && !config)}
                isPending={testing}
                variant="outline"
                onPress={handleTestConnection}
              >
                {t("testConnection")}
              </Button>
              <Button
                isDisabled={!canSave || Object.keys(timeErrors).length > 0}
                isPending={saving}
                variant="primary"
                onPress={handleSave}
              >
                {tConfig("saveChanges")}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
