# Build context: backend/ (see docker-compose.yml in the repository root).

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Restore first, so that the package layer is reused while only code changes.
COPY Directory.Build.props Directory.Packages.props ./
COPY ChessReview.Api/ChessReview.Api.csproj ChessReview.Api/
COPY ChessReview.Domain/ChessReview.Domain.csproj ChessReview.Domain/
COPY ChessReview.Infrastructure/ChessReview.Infrastructure.csproj ChessReview.Infrastructure/
COPY ChessReview.ExplanationWorker/ChessReview.ExplanationWorker.csproj ChessReview.ExplanationWorker/
RUN dotnet restore ChessReview.Api/ChessReview.Api.csproj

COPY . .
RUN dotnet publish ChessReview.Api/ChessReview.Api.csproj --configuration Release --no-restore --output /app

FROM mcr.microsoft.com/dotnet/aspnet:10.0

# curl for the container health check in docker-compose.yml.
RUN apt-get update \
    && apt-get install --yes --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=build /app .

USER $APP_UID
EXPOSE 8080
ENTRYPOINT ["dotnet", "ChessReview.Api.dll"]
