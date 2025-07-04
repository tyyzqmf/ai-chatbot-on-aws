#!/bin/bash
set -e

# This script implements file-based caching for CloudFormation stack outputs
# Cache files are stored in .cache directory with a 1-minute expiration
# Format: .cache/cfn-<stackName>[-profile][-region].json

# Function to ensure cache directory exists
ensure_cache_dir() {
    local cache_dir=".cache"
    if [ ! -d "$cache_dir" ]; then
        mkdir -p "$cache_dir"
    fi
}

# Function to get cache file path
get_cache_file() {
    local stackName=$1
    local profile=$2
    local region=$3
    ensure_cache_dir
    echo ".cache/cfn-${stackName}${profile:+-$profile}${region:+-$region}.json"
}

# Function to get and cache stack outputs
cache_stack_outputs() {
    local stackName=$1
    local profile=$2
    local region=$3
    local cache_file
    cache_file=$(get_cache_file "$stackName" "$profile" "$region")

    # Enable debug logging if DEBUG environment variable is set
    if [ "${DEBUG:-}" = "true" ]; then
        echo "Debug: Checking cache file: $cache_file" >&2
    fi

    # Check if cache file exists and is less than 5 minutes old
    if [ -f "$cache_file" ]; then
        local current_time
        local file_time
        current_time=$(date +%s)
        file_time=$(stat -c %Y "$cache_file")
        
        if [ $((current_time - file_time)) -lt 60 ]; then
            if [ "${DEBUG:-}" = "true" ]; then
                echo "Debug: Using cache file (less than 1 minutes old)" >&2
            fi
            return 0
        fi
    fi

    if [ "${DEBUG:-}" = "true" ]; then
        echo "Debug: Cache miss - fetching from CloudFormation" >&2
    fi

    # Cache miss - get all outputs and store in cache file
    local stack_outputs
    if ! stack_outputs=$(aws cloudformation describe-stacks $profile $region \
        --stack-name "$stackName" \
        --query "Stacks[0].Outputs[]" \
        --output json 2>&1); then
        # If we have a stale cache file, use it rather than failing
        if [ -f "$cache_file" ]; then
            echo "Warning: Failed to fetch fresh data, using stale cache: $stack_outputs" >&2
            return 0
        fi
        echo "Error fetching CloudFormation stack outputs: $stack_outputs" >&2
        return 1
    fi
    
    # Validate JSON output
    if ! echo "$stack_outputs" | jq empty >/dev/null 2>&1; then
        echo "Error: Invalid JSON response from CloudFormation" >&2
        return 1
    fi
    
    # Save to cache file
    echo "$stack_outputs" > "$cache_file"
    
    if [ "${DEBUG:-}" = "true" ]; then
        echo "Debug: Saved CloudFormation outputs to cache file" >&2
    fi
}

get_stack_output() {
    local stackName=$1
    local outputKey=$2
    local profile=$3
    local region=$4

    if [ -z "$stackName" ] || [ -z "$outputKey" ]; then
        echo "Usage: get_stack_output <stackName> <outputKey>"
        return 1
    fi

    # Ensure outputs are cached
    cache_stack_outputs "$stackName" "$profile" "$region"

    # Get cache file path
    local cache_file
    cache_file=$(get_cache_file "$stackName" "$profile" "$region")

    # Get value from cache
    local stack_output
    stack_output=$(jq -r ".[] | select(.OutputKey==\"$outputKey\") | .OutputValue" "$cache_file")
    
    # Check if output key exists
    if [ -z "$stack_output" ]; then
        echo "Error: Output key '$outputKey' not found in stack '$stackName'" >&2
        return 1
    fi

    echo "$stack_output"
}
