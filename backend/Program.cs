using backend.src.Domain.Interfaces;
using backend.src.Application.Services;
using backend.src.Infrastructure.Parsers;
using System.Text.Json.Serialization;

var builder = WebApplication.CreateBuilder(args);

// Register services with dependency injection
builder.Services.AddScoped<IReconciliationService, ReconciliationService>();
builder.Services.AddScoped<IFileParserService, CsvFileParserService>();

// Controllers + OpenAPI — serialize enums as camelCase strings
builder.Services.AddControllers()
    .AddJsonOptions(opts =>
    {
        opts.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter(System.Text.Json.JsonNamingPolicy.CamelCase));
    });
builder.Services.AddOpenApi();

// CORS — allow Angular dev server
builder.Services.AddCors(opts => opts.AddDefaultPolicy(p =>
    p.WithOrigins("http://localhost:4200")
     .AllowAnyHeader()
     .AllowAnyMethod()));

var app = builder.Build();

if (app.Environment.IsDevelopment())
    app.MapOpenApi();

app.UseCors();
app.UseAuthorization();
app.MapControllers();
app.Run();
