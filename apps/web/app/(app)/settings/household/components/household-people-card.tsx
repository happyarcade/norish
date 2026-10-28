"use client";

import { useEffect, useMemo, useState } from "react";
import { useTRPC } from "@/app/providers/trpc-provider";
import Panel, { PANEL_HEIGHT_COMPACT } from "@/components/Panel/Panel";
import { useIsDesktop } from "@/components/planner/use-is-desktop";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { PlusIcon, UserGroupIcon, UserIcon, UserPlusIcon } from "@heroicons/react/24/outline";
import {
  InputGroup,
  Label,
  ListBox,
  Modal,
  Select,
  Spinner,
  Switch,
  Table,
  TextField,
  useOverlayState,
} from "@heroui-v3/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { TRPCClientError } from "@trpc/client";

import { useHouseholdSettingsContext } from "../context";

type PersonFormState = {
  id: string | null;
  displayName: string;
  kind: "adult" | "child";
  portionFactor: string;
  linkedUserId: string | null;
  isActive: boolean;
};

function roundPortionUnits(value: number): number {
  return Math.round(value * 100) / 100;
}

function createEmptyForm(): PersonFormState {
  return {
    id: null,
    displayName: "",
    kind: "adult",
    portionFactor: "1",
    linkedUserId: null,
    isActive: true,
  };
}

export default function HouseholdPeopleCard() {
  const { household, currentUserId } = useHouseholdSettingsContext();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const isDesktop = useIsDesktop();
  const [formState, setFormState] = useState<PersonFormState | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const personModalState = useOverlayState({
    isOpen: Boolean(formState),
    onOpenChange: (open) => {
      if (!open) {
        setFormError(null);
        setFormState(null);
      }
    },
  });

  const peopleQuery = useQuery({
    ...trpc.households.listPeople.queryOptions(),
    enabled: Boolean(household),
  });

  const upsertMutation = useMutation(
    trpc.households.upsertPerson.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries();
        setFormError(null);
        setFormState(null);
      },
      onError: (error) => {
        setFormError(
          error instanceof TRPCClientError
            ? error.message
            : "Could not save this person right now. Please try again."
        );
      },
    })
  );
  const deleteMutation = useMutation(
    trpc.households.deletePerson.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries();
        setFormError(null);
        setFormState(null);
      },
      onError: (error) => {
        setFormError(
          error instanceof TRPCClientError
            ? error.message
            : "Could not delete this person right now. Please try again."
        );
      },
    })
  );

  const people = useMemo(() => peopleQuery.data ?? [], [peopleQuery.data]);
  const activePeople = people.filter((person) => person.isActive);
  const totalPortionUnits = roundPortionUnits(
    activePeople.reduce((sum, person) => sum + person.portionFactor, 0)
  );

  const currentUser = currentUserId
    ? (household?.users.find((user) => user.id === currentUserId) ?? null)
    : null;
  const isAdmin = currentUser?.isAdmin === true;
  const linkedUserOptions = useMemo(() => household?.users ?? [], [household?.users]);
  const linkedUserIdsInUse = useMemo(
    () =>
      new Set(
        people
          .filter((person) => person.id !== formState?.id)
          .map((person) => person.linkedUserId)
          .filter((linkedUserId): linkedUserId is string => Boolean(linkedUserId))
      ),
    [formState?.id, people]
  );
  const availableLinkedUserOptions = useMemo(
    () =>
      linkedUserOptions.filter(
        (user) => user.id === formState?.linkedUserId || !linkedUserIdsInUse.has(user.id)
      ),
    [formState?.linkedUserId, linkedUserIdsInUse, linkedUserOptions]
  );

  useEffect(() => {
    if (!formState?.linkedUserId) return;

    const linkedUser = linkedUserOptions.find((user) => user.id === formState.linkedUserId);

    if (!linkedUser) return;

    setFormState((current) => {
      if (!current || current.linkedUserId !== linkedUser.id) return current;
      if (
        current.displayName.trim().length > 0 &&
        current.displayName !== current.displayName.trim()
      ) {
        return {
          ...current,
          displayName: current.displayName.trim(),
        };
      }
      if (current.displayName.trim().length > 0) return current;

      return {
        ...current,
        displayName: linkedUser.name ?? "",
      };
    });
  }, [formState?.linkedUserId, linkedUserOptions]);

  const canSave = useMemo(() => {
    if (!formState) return false;

    const portionFactor = Number(formState.portionFactor);

    return (
      formState.displayName.trim().length > 0 && Number.isFinite(portionFactor) && portionFactor > 0
    );
  }, [formState]);

  if (!household) return null;

  const handleEdit = (person: (typeof people)[number]) => {
    setFormError(null);
    setFormState({
      id: person.id,
      displayName: person.displayName,
      kind: person.kind,
      portionFactor: person.portionFactor.toString(),
      linkedUserId: person.linkedUserId,
      isActive: person.isActive,
    });
  };

  const handleCreate = () => {
    setFormError(null);
    setFormState(createEmptyForm());
  };

  const handleSave = async () => {
    if (!formState || !canSave) return;

    const payload = {
      displayName: formState.displayName.trim(),
      kind: formState.kind,
      portionFactor: Number(formState.portionFactor),
      linkedUserId: formState.linkedUserId,
      isActive: formState.isActive,
    };

    await upsertMutation.mutateAsync(
      formState.id
        ? {
            id: formState.id,
            data: payload,
          }
        : {
            data: payload,
          }
    );
  };

  const handleDelete = async () => {
    if (!formState?.id) return;

    await deleteMutation.mutateAsync({ id: formState.id });
  };

  const form = formState ? (
    <div className="flex flex-col gap-4">
      <TextField
        fullWidth
        value={formState.displayName}
        onChange={(value) =>
          setFormState((current) => (current ? { ...current, displayName: value } : current))
        }
      >
        <Label>Display name</Label>
        <InputGroup fullWidth variant="secondary">
          <InputGroup.Input placeholder="e.g. Olivia" />
        </InputGroup>
      </TextField>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Select
          fullWidth
          selectedKey={formState.kind}
          variant="secondary"
          onSelectionChange={(selected) => {
            if (selected !== "adult" && selected !== "child") return;

            setFormState((current) => (current ? { ...current, kind: selected } : current));
          }}
        >
          <Label>Person type</Label>
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox aria-label="Person type">
              <ListBox.Item id="adult" textValue="Adult">
                Adult
                <ListBox.ItemIndicator />
              </ListBox.Item>
              <ListBox.Item id="child" textValue="Child">
                Child
                <ListBox.ItemIndicator />
              </ListBox.Item>
            </ListBox>
          </Select.Popover>
        </Select>

        <TextField
          fullWidth
          value={formState.portionFactor}
          onChange={(value) =>
            setFormState((current) => (current ? { ...current, portionFactor: value } : current))
          }
        >
          <Label>Portion factor</Label>
          <InputGroup fullWidth variant="secondary">
            <InputGroup.Input min={0.1} placeholder="1.0" step={0.1} type="number" />
          </InputGroup>
        </TextField>
      </div>

      <Select
        fullWidth
        selectedKey={formState.linkedUserId ?? "__none__"}
        variant="secondary"
        onSelectionChange={(selected) =>
          setFormState((current) => {
            if (!current || typeof selected !== "string") return current;

            return {
              ...current,
              linkedUserId: selected === "__none__" ? null : selected,
            };
          })
        }
      >
        <Label>Linked household user</Label>
        <Select.Trigger>
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox aria-label="Linked household user">
            <ListBox.Item id="__none__" textValue="No linked login">
              No linked login
              <ListBox.ItemIndicator />
            </ListBox.Item>
            {availableLinkedUserOptions.map((user) => (
              <ListBox.Item key={user.id} id={user.id} textValue={user.name ?? "Household member"}>
                {user.name ?? "Household member"}
                <ListBox.ItemIndicator />
              </ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
      </Select>

      {formError ? <div className="text-danger text-sm">{formError}</div> : null}

      <Switch
        aria-label="Count this person in default household meals"
        isSelected={formState.isActive}
        onChange={(value) =>
          setFormState((current) => (current ? { ...current, isActive: value } : current))
        }
      >
        <Switch.Content>
          <span>Count this person in default household meals</span>
          <Switch.Control>
            <Switch.Thumb />
          </Switch.Control>
        </Switch.Content>
      </Switch>

      <div className="flex items-center justify-between gap-3">
        <div className="text-default-500 text-sm">
          Adults can be linked to logins. Children and guests can stay unlinked.
        </div>

        {formState.id ? (
          <Button
            isDisabled={deleteMutation.isPending || upsertMutation.isPending}
            variant="danger-soft"
            onPress={handleDelete}
          >
            Delete
          </Button>
        ) : null}
      </div>
    </div>
  ) : null;

  return (
    <>
      <Card>
        <Card.Header className="flex items-start gap-3">
          <div className="bg-primary/10 text-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
            <UserGroupIcon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold">People fed</h2>
            <p className="text-default-500 mt-1 text-sm leading-relaxed">
              Separate the people you feed from the members who can log in. This lets you model
              children, guests, and smaller portion sizes cleanly.
            </p>
          </div>
          {isAdmin ? (
            <Button className="rounded-full" variant="secondary" onPress={handleCreate}>
              <PlusIcon className="h-4 w-4" />
              Add person
            </Button>
          ) : null}
        </Card.Header>
        <Card.Content className="gap-5">
          {peopleQuery.isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Spinner />
            </div>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                <Chip size="sm" variant="soft">
                  <Chip.Label>{activePeople.length} active eaters</Chip.Label>
                </Chip>
                <Chip size="sm" variant="soft">
                  <Chip.Label>{totalPortionUnits} default portion units</Chip.Label>
                </Chip>
              </div>

              {people.length > 0 ? (
                <Table>
                  <Table.ScrollContainer>
                    <Table.Content aria-label="Household people">
                      <Table.Header>
                        <Table.Column isRowHeader>Name</Table.Column>
                        <Table.Column>Type</Table.Column>
                        <Table.Column>Portion</Table.Column>
                        <Table.Column>Status</Table.Column>
                        <Table.Column>Linked user</Table.Column>
                        {isAdmin ? <Table.Column>Actions</Table.Column> : null}
                      </Table.Header>
                      <Table.Body>
                        {people.map((person) => {
                          const linkedUser =
                            linkedUserOptions.find((user) => user.id === person.linkedUserId) ??
                            null;

                          return (
                            <Table.Row key={person.id} id={person.id}>
                              <Table.Cell>
                                <div className="flex items-center gap-2">
                                  {person.linkedUserId ? (
                                    <UserIcon className="text-default-400 h-4 w-4" />
                                  ) : (
                                    <UserPlusIcon className="text-default-400 h-4 w-4" />
                                  )}
                                  <span>{person.displayName}</span>
                                </div>
                              </Table.Cell>
                              <Table.Cell>
                                <Chip size="sm" variant="soft">
                                  <Chip.Label>
                                    {person.kind === "adult" ? "Adult" : "Child"}
                                  </Chip.Label>
                                </Chip>
                              </Table.Cell>
                              <Table.Cell>{person.portionFactor}</Table.Cell>
                              <Table.Cell>
                                <Chip
                                  color={person.isActive ? "success" : "default"}
                                  size="sm"
                                  variant="soft"
                                >
                                  <Chip.Label>{person.isActive ? "Active" : "Optional"}</Chip.Label>
                                </Chip>
                              </Table.Cell>
                              <Table.Cell>{linkedUser?.name ?? "None"}</Table.Cell>
                              {isAdmin ? (
                                <Table.Cell>
                                  <Button
                                    size="sm"
                                    variant="tertiary"
                                    onPress={() => handleEdit(person)}
                                  >
                                    Edit
                                  </Button>
                                </Table.Cell>
                              ) : null}
                            </Table.Row>
                          );
                        })}
                      </Table.Body>
                    </Table.Content>
                  </Table.ScrollContainer>
                </Table>
              ) : (
                <p className="text-default-500 py-6 text-center text-sm">
                  No household people added yet.
                </p>
              )}
            </>
          )}
        </Card.Content>
      </Card>

      {isDesktop ? (
        <Modal state={personModalState}>
          <Modal.Backdrop variant="blur">
            <Modal.Container placement="center" scroll="inside" size="lg">
              <Modal.Dialog className="max-w-xl">
                <Modal.CloseTrigger aria-label="Cancel" />
                <Modal.Header>
                  <Modal.Heading>{formState?.id ? "Edit person" : "Add person"}</Modal.Heading>
                </Modal.Header>
                <Modal.Body className="pb-6">{form}</Modal.Body>
                <Modal.Footer>
                  <Button variant="tertiary" onPress={personModalState.close}>
                    Cancel
                  </Button>
                  <Button
                    isDisabled={!canSave || upsertMutation.isPending || deleteMutation.isPending}
                    isPending={upsertMutation.isPending}
                    variant="primary"
                    onPress={handleSave}
                  >
                    Save
                  </Button>
                </Modal.Footer>
              </Modal.Dialog>
            </Modal.Container>
          </Modal.Backdrop>
        </Modal>
      ) : (
        <Panel
          height={PANEL_HEIGHT_COMPACT}
          open={Boolean(formState)}
          title={formState?.id ? "Edit person" : "Add person"}
          onOpenChange={(open) => {
            if (!open) {
              setFormError(null);
              setFormState(null);
            }
          }}
        >
          <div className="flex h-full flex-col gap-4">
            {form}
            <div className="flex justify-end gap-2">
              <Button variant="tertiary" onPress={() => setFormState(null)}>
                Cancel
              </Button>
              <Button
                isDisabled={!canSave || upsertMutation.isPending || deleteMutation.isPending}
                isPending={upsertMutation.isPending}
                variant="primary"
                onPress={handleSave}
              >
                Save
              </Button>
            </div>
          </div>
        </Panel>
      )}
    </>
  );
}
