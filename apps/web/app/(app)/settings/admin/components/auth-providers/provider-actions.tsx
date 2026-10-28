"use client";

import { Button } from "@/components/ui/button";
import { BeakerIcon, CheckIcon, TrashIcon } from "@heroicons/react/16/solid";
import { useTranslations } from "next-intl";

interface ProviderActionsProps {
  hasConfig: boolean;
  hasChanges: boolean;
  testing: boolean;
  saving: boolean;
  onTest: () => void;
  onSave: () => void;
  onDeleteClick: () => void;
}

export function ProviderActions({
  hasConfig,
  hasChanges,
  testing,
  saving,
  onTest,
  onSave,
  onDeleteClick,
}: ProviderActionsProps) {
  const tActions = useTranslations("common.actions");

  return (
    <div className="flex items-center justify-between pt-2">
      {hasConfig && (
        <Button variant="danger-soft" onPress={onDeleteClick}>
          <TrashIcon className="h-5 w-5" />
          {tActions("remove")}
        </Button>
      )}
      <div className="ml-auto flex gap-2">
        <Button isPending={testing} variant="secondary" onPress={onTest}>
          <BeakerIcon className="h-5 w-5" />
          {tActions("test")}
        </Button>
        <Button isDisabled={!hasChanges} isPending={saving} variant="primary" onPress={onSave}>
          <CheckIcon className="h-5 w-5" />
          {tActions("save")}
        </Button>
      </div>
    </div>
  );
}
