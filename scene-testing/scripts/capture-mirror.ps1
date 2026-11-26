param(
  # Process name of the phone-mirroring app on the PC (the one whose window shows the phone screen).
  [Parameter(Mandatory = $true)][string]$Process,
  [string]$OutDir = (Join-Path (Get-Location) 'phone-frames'),
  [int]$IntervalMs = 1000,
  # Mean change of a 48x27 grey thumbnail, 0-255 scale. Raise it if idle animation keeps too many frames.
  [double]$Threshold = 4.0,
  [double]$Minutes = 30
)
# Windows only. Captures the mirroring window about once a second and keeps a frame only when the
# picture changed, so a 30-minute session yields a reviewable set of JPGs instead of thousands.
# Works while the window is covered by other windows (PrintWindow with full-content rendering),
# not while it is minimised. Run a one-minute test first and check that frames are being kept.
Add-Type -AssemblyName System.Drawing
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class Win {
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L, T, R, B; }
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr h, IntPtr dc, uint flags);
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
}
'@
[Win]::SetProcessDPIAware() | Out-Null
New-Item -ItemType Directory -Force $OutDir | Out-Null
$proc = Get-Process $Process -ErrorAction Stop | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1
if (-not $proc) { throw "No window found for process '$Process'." }
$h = $proc.MainWindowHandle
$jpg = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
$enc = New-Object System.Drawing.Imaging.EncoderParameters 1
$enc.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality), 80L
$prev = $null; $kept = 0; $seen = 0
$until = (Get-Date).AddMinutes($Minutes)
while ((Get-Date) -lt $until) {
  $r = New-Object Win+RECT
  [Win]::GetWindowRect($h, [ref]$r) | Out-Null
  $w = $r.R - $r.L; $ht = $r.B - $r.T
  if ($w -gt 50 -and $ht -gt 50) {
    $bmp = New-Object System.Drawing.Bitmap $w, $ht
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $dc = $g.GetHdc(); [Win]::PrintWindow($h, $dc, 2) | Out-Null; $g.ReleaseHdc($dc); $g.Dispose()
    $thumb = New-Object System.Drawing.Bitmap $bmp, 48, 27
    $vals = New-Object 'double[]' (48 * 27)
    for ($y = 0; $y -lt 27; $y++) { for ($x = 0; $x -lt 48; $x++) { $c = $thumb.GetPixel($x, $y); $vals[$y * 48 + $x] = 0.3 * $c.R + 0.59 * $c.G + 0.11 * $c.B } }
    $thumb.Dispose(); $seen++
    $diff = 255.0
    if ($prev) { $sum = 0.0; for ($i = 0; $i -lt $vals.Length; $i++) { $sum += [Math]::Abs($vals[$i] - $prev[$i]) }; $diff = $sum / $vals.Length }
    if ($diff -ge $Threshold) {
      # Time of day plus a running number keeps the files in order and easy to cite in findings.
      $name = Join-Path $OutDir ('{0:HHmmss}-{1:d4}.jpg' -f (Get-Date), $kept)
      $bmp.Save($name, $jpg, $enc); $kept++; $prev = $vals
      Write-Output ("kept {0} (diff {1:n1})" -f (Split-Path $name -Leaf), $diff)
    }
    $bmp.Dispose()
  }
  Start-Sleep -Milliseconds $IntervalMs
}
Write-Output "done: $kept kept of $seen captured"
