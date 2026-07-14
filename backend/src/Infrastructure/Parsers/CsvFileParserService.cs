using backend.src.Domain.Interfaces;
using backend.src.Domain.Models;

namespace backend.src.Infrastructure.Parsers;

/// <summary>
/// Parses CSV files from E-Leave and ITAS exports.
/// Extensibility point: replace with EPPlus Excel parser or API adapter in future phases.
/// </summary>
public class CsvFileParserService : IFileParserService
{
    public async Task<IEnumerable<ELeaveRecord>> ParseELeaveAsync(Stream stream, string fileName)
    {
        using var reader = new StreamReader(stream);
        var csvText = await reader.ReadToEndAsync();
        var rows = ParseCsv(csvText);

        return rows.Select(r => new ELeaveRecord(
            EmployeeId:       GetVal(r, "Employee ID", "EmployeeID"),
            EmployeeName:     GetVal(r, "Employee Name", "EmployeeName"),
            Department:       GetVal(r, "Department"),
            ReportingManager: GetVal(r, "Reporting Manager"),
            LeaveType:        GetVal(r, "Leave Type", "LeaveType"),
            From:             ParseDate(GetVal(r, "From", "StartDate")),
            To:               ParseDate(GetVal(r, "To", "EndDate")),
            Days:             double.TryParse(GetVal(r, "Days"), out var d) ? d : 1,
            Status:           GetVal(r, "Status") is { Length: > 0 } s ? s
                              : GetVal(r, "Leave Type", "LeaveType") is { Length: > 0 } lt ? lt
                              : "Approved",
            AppliedDate:      ParseDate(GetVal(r, "Applied Date", "AppliedDate"))
        )).Where(r => !string.IsNullOrWhiteSpace(r.EmployeeId)).ToList();
    }

    public async Task<IEnumerable<ITASRecord>> ParseITASAsync(Stream stream, string fileName)
    {
        using var reader = new StreamReader(stream);
        var csvText = await reader.ReadToEndAsync();
        var rows = ParseCsv(csvText);

        var byEmp = new Dictionary<string, ITASRecord>();

        foreach (var r in rows)
        {
            var id = GetVal(r, "Employee Id", "Employee ID", "EmployeeID", "EmployeeId");
            if (string.IsNullOrWhiteSpace(id)) continue;

            if (!byEmp.ContainsKey(id))
                byEmp[id] = new ITASRecord(
                    EmployeeId:       id,
                    EmployeeName:     GetVal(r, "Employee Name", "EmployeeName"),
                    Department:       GetVal(r, "Department"),
                    ReportingManager: GetVal(r, "Reporting Manager"),
                    WeekEnding:       ParseDate(GetVal(r, "Week Ending", "WeekEnding")),
                    Entries:          new List<ITASEntry>(),
                    Submitted:        true);

            var hours = double.TryParse(GetVal(r, "Hours", "Hrs on PAR"), out var h) ? h : 0;
            var parCode  = GetVal(r, "PAR Name", "PAR", "Type");
            var leaveType = MapITASType(parCode);

            // Only store recognised leave entries; skip Work/Training/Overhead/etc.
            if (leaveType == null) continue;

            byEmp[id].Entries.Add(new ITASEntry(
                Date:           ParseDate(GetVal(r, "Date")),
                Type:           leaveType,
                Par:            parCode,
                Hours:          hours,
                Phase:          GetVal(r, "Phase"),
                ParDescription: GetVal(r, "PAR Description")
            ));
        }

        return byEmp.Values;
    }

    private static List<Dictionary<string, string>> ParseCsv(string text)
    {
        var lines = text.Replace("\r\n", "\n").Replace("\r", "\n").Split('\n', StringSplitOptions.RemoveEmptyEntries);
        if (lines.Length < 2) return [];
        var headers = lines[0].Split(',').Select(h => h.Trim(' ', '"')).ToArray();
        return lines.Skip(1).Select(line =>
        {
            var vals = line.Split(',').Select(v => v.Trim(' ', '"')).ToArray();
            var dict = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            for (int i = 0; i < headers.Length; i++) dict[headers[i]] = i < vals.Length ? vals[i] : "";
            return dict;
        }).ToList();
    }

    private static string GetVal(Dictionary<string, string> row, params string[] keys)
    {
        foreach (var k in keys) if (row.TryGetValue(k, out var v) && !string.IsNullOrWhiteSpace(v)) return v.Trim();
        return "";
    }

    private static DateOnly ParseDate(string value)
    {
        if (DateOnly.TryParse(value, out var d)) return d;
        if (DateTime.TryParse(value, out var dt)) return DateOnly.FromDateTime(dt);
        return DateOnly.MinValue;
    }

    private static string? MapITASType(string par)
    {
        if (string.IsNullOrWhiteSpace(par)) return null; // empty = regular work, skip
        var p = par.ToLowerInvariant().Trim();
        if (p.Contains("illness") || p.Contains("sick"))    return "Illness";
        if (p.Contains("vacation") || p.Contains("annual")) return "Vacation";
        if (p.Contains("holiday"))                          return "Holiday";
        if (p.Contains("casual") || p.Contains("unpaid"))   return "Vacation";
        if (p.Contains("leave"))                            return "Vacation";
        // Non-standard absence types (Training, Other Out of Office, etc.) — keep original name
        return par;
    }
}
