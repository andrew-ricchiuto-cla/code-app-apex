# Project Instructions

## Power Platform CLI Auth

Before every `pac code push`, select the project auth profile:

```powershell
pac auth select --name apex
```

If the `apex` auth profile does not exist, create it:

```powershell
pac auth create --name apex --environment b242d458-565e-e01e-b2f0-00fe9b365e15
```

If the `apex` auth profile exists but is stale, delete and recreate it:

```powershell
pac auth delete --name apex
pac auth create --name apex --environment b242d458-565e-e01e-b2f0-00fe9b365e15
```
