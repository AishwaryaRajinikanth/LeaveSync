using backend.src.Domain.Interfaces;
using backend.src.Application.Services;
using backend.src.Infrastructure.Parsers;
using backend.src.Infrastructure.Services;
using System.Text.Json.Serialization;

var builder = WebApplication.CreateBuilder(args);

// Register services with dependency injection
builder.Services.AddScoped<IReconciliationService, ReconciliationService>();
builder.Services.AddScoped<IFileParserService, CsvFileParserService>();
builder.Services.AddScoped<IEmailService, AcsEmailService>();

// Controllers + OpenAPI — serialize enums as camelCase strings
builder.Services.AddControllers()
    .AddJsonOptions(opts =>
    {
        opts.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter(System.Text.Json.JsonNamingPolicy.CamelCase));
    });
builder.Services.AddOpenApi();

// CORS — allow any localhost port + production Static Web App
builder.Services.AddCors(opts => opts.AddDefaultPolicy(p =>
    p.SetIsOriginAllowed(origin =>
        new Uri(origin).Host == "localhost" ||
        origin == "https://witty-water-0d4e0fc1e.7.azurestaticapps.net")
     .AllowAnyHeader()
     .AllowAnyMethod()));

var app = builder.Build();

if (app.Environment.IsDevelopment())
    app.MapOpenApi();

app.UseCors();
app.UseAuthorization();
app.MapControllers();
app.Run();
