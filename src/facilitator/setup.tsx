// Facilitator: game setup — name, teams, who can facilitate, and (local sandbox)
// export / import / reset.

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { exportGame, freshGame, importGame, useGame } from "@/lib/store";
import { normalizeEmail, useCurrentUser } from "@/lib/user";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function GameSetup() {
  const { state, dispatch, session } = useGame();
  const user = useCurrentUser();
  const isShared = session.mode === "shared";
  const [newFacilitator, setNewFacilitator] = useState("");
  const [importText, setImportText] = useState("");
  const closeImport = useRef<HTMLButtonElement>(null);

  const addFacilitator = () => {
    const email = normalizeEmail(newFacilitator);
    if (!EMAIL.test(email)) {
      toast.error("Enter a valid work email address");
      return;
    }
    if (state.facilitators.includes(email)) {
      toast.info(`${email} is already a facilitator`);
      return;
    }
    dispatch({ type: "setFacilitators", facilitators: [...state.facilitators, email] });
    setNewFacilitator("");
    toast.success(`${email} can now open the Facilitator Console`);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Game</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1">
              <Label className="text-xs">Game name</Label>
              <Input className="w-72" value={state.gameName} onChange={(e) => dispatch({ type: "setGameName", name: e.target.value })} />
            </div>
            {!isShared && (
              <div className="space-y-1">
                <Label className="text-xs">Teams</Label>
                <Input
                  type="number"
                  min={1}
                  max={12}
                  className="w-20"
                  value={state.teams.length}
                  onChange={(e) => dispatch({ type: "setTeamCount", count: Number(e.target.value) || 1 })}
                />
              </div>
            )}
            <div className="flex items-center gap-2 pb-2">
              <Switch checked={state.underHood} onCheckedChange={(v) => dispatch({ type: "setUnderHood", value: v })} />
              <Label className="text-xs">Show engine trace in team drill-in</Label>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {state.teams.map((team) => (
              <Input key={team.id} value={team.name} onChange={(e) => dispatch({ type: "renameTeam", teamId: team.id, name: e.target.value })} />
            ))}
          </div>
          {isShared && <p className="text-muted-foreground text-xs">Team count is fixed when a shared game is created.</p>}
        </CardContent>
      </Card>

      {isShared && (
        <Card>
          <CardHeader>
            <CardTitle>Facilitators</CardTitle>
            <CardDescription>
              Only these people can open this game's Facilitator Console. Everyone else joins as a player. Add co-facilitators by work email.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <ul className="space-y-1.5">
              {state.facilitators.map((email) => (
                <li key={email} className="flex items-center justify-between gap-3 rounded-md border px-3 py-1.5 text-sm">
                  <span>
                    {email} {user?.upn === email && <Badge variant="outline">you</Badge>}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={state.facilitators.length <= 1 || user?.upn === email}
                    title={user?.upn === email ? "You can't remove yourself" : undefined}
                    onClick={() => dispatch({ type: "setFacilitators", facilitators: state.facilitators.filter((f) => f !== email) })}
                  >
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
            <div className="flex gap-2">
              <Input
                className="w-80"
                placeholder="name@claconnect.com"
                value={newFacilitator}
                onChange={(e) => setNewFacilitator(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addFacilitator()}
              />
              <Button onClick={addFacilitator}>Add co-facilitator</Button>
            </div>
            <p className="text-muted-foreground text-xs">
              This is an in-app gate. Co-facilitators also need access to the Apex Simulation app and the ApexFacilitator (or ApexPlayer) security role.
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Data</CardTitle>
          <CardDescription>{isShared ? "Shared games save to Dataverse automatically." : "The sandbox saves in this browser. Export to back up or move a session."}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={async () => {
              await navigator.clipboard.writeText(exportGame(state));
              toast.success("Game JSON copied to clipboard");
            }}
          >
            Copy game JSON
          </Button>
          {!isShared && (
            <>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline">Import game JSON</Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Import game</DialogTitle>
                    <DialogDescription>Paste an exported game JSON. This replaces the current sandbox.</DialogDescription>
                  </DialogHeader>
                  <Textarea rows={12} value={importText} onChange={(e) => setImportText(e.target.value)} placeholder="{ ... }" />
                  <DialogFooter>
                    <DialogClose ref={closeImport} className="hidden" />
                    <Button
                      onClick={() => {
                        try {
                          dispatch({ type: "replace", state: importGame(importText) });
                          setImportText("");
                          toast.success("Game imported");
                          closeImport.current?.click();
                        } catch (err) {
                          toast.error(err instanceof Error ? err.message : "Import failed");
                        }
                      }}
                    >
                      Import
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="destructive">Reset sandbox</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Reset the sandbox?</DialogTitle>
                    <DialogDescription>All decisions, rulings, and model edits are erased. Copy the game JSON first if you might want it back.</DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <DialogClose asChild>
                      <Button
                        variant="destructive"
                        onClick={() => {
                          dispatch({ type: "replace", state: freshGame(state.teams.length) });
                          toast.success("Sandbox reset");
                        }}
                      >
                        Reset everything
                      </Button>
                    </DialogClose>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
